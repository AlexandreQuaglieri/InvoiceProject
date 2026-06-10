import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { decryptSecretOrNull } from '@/lib/crypto'

// Cible d'extraction : fiche entreprise (Kbis), fiche client (email/signature/devis)
// ou facture (description de prestation). Entrée : document (PDF/image) OU texte libre.
type ExtractKind = 'company' | 'client' | 'invoice'

const CLIENT_PROMPT = `Tu es un assistant spécialisé dans l'extraction de coordonnées clients depuis du texte ou des documents (emails, signatures, cartes de visite, devis, Kbis).

Analyse le contenu et extrais les informations du CLIENT au format JSON strict.

RÈGLES IMPORTANTES:
1. Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après
2. Si une information n'est pas trouvée, ne l'inclus pas (pas de null)
3. "type": "professional" si c'est une entreprise (SIRET, raison sociale, TVA), "individual" si c'est un particulier

FORMAT JSON:
{
  "name": "Raison sociale ou Prénom Nom",
  "type": "professional",
  "email": "contact@exemple.fr",
  "phone": "06 12 34 56 78",
  "address": "12 rue Exemple",
  "postal_code": "75001",
  "city": "Paris",
  "siret": "52018152000011",
  "vat_number": "FR40520181520"
}

Analyse le contenu et retourne le JSON:`

const INVOICE_PROMPT = `Tu es un assistant spécialisé dans la préparation de factures françaises à partir d'une description libre de prestation.

Analyse la description et structure les lignes de facture au format JSON strict.

RÈGLES IMPORTANTES:
1. Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après
2. Si une information n'est pas trouvée, ne l'inclus pas (pas de null)
3. Les montants donnés sont supposés HT sauf mention TTC explicite (dans ce cas convertis en HT avec le taux de TVA)
4. "vat_rate": 20 par défaut sauf mention contraire (10, 5.5, 2.1 ou 0)
5. "client_name": le nom du client si mentionné dans la description
6. Quantité par défaut: 1

FORMAT JSON:
{
  "client_name": "Studio Méridien",
  "items": [
    { "description": "Refonte d'identité visuelle", "quantity": 1, "unit_price": 2400, "vat_rate": 20 }
  ],
  "notes": "Acompte de 30 % à la commande"
}

Analyse la description et retourne le JSON:`

const EXTRACTION_PROMPT = `Tu es un assistant spécialisé dans l'extraction de données de documents officiels français (Kbis, extraits d'immatriculation).

Analyse ce document et extrais les informations au format JSON strict.

RÈGLES IMPORTANTES:
1. Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après
2. Si une information n'est pas trouvée, ne l'inclus pas (pas de null)
3. Pour le SIREN: 9 chiffres (ex: 520181520)
4. Pour le SIRET: 14 chiffres = SIREN + NIC (si non visible, ne pas l'inclure)

FORME JURIDIQUE - Utilise ces valeurs exactes:
- "ei" = Entreprise Individuelle, personne physique immatriculée au RCS (comme sur ce type de Kbis)
- "auto_entrepreneur" = Micro-entrepreneur (régime fiscal simplifié, souvent pas de Kbis)
- "eurl" = EURL (Entreprise Unipersonnelle à Responsabilité Limitée)
- "sarl" = SARL
- "sasu" = SASU (Société par Actions Simplifiée Unipersonnelle)
- "sas" = SAS
- "sa" = SA
- "association" = Association loi 1901
- "profession_liberale" = Profession libérale

INDICES pour identifier la forme:
- "Immatriculation principale d'une personne physique" → "ei"
- "Société à responsabilité limitée" → "sarl" ou "eurl" (si associé unique)
- "Société par actions simplifiée" → "sas" ou "sasu" (si associé unique)
- Capital social mentionné → généralement une société (SARL, SAS, etc.)
- Pas de capital + personne physique → "ei"

FORMAT JSON:
{
  "name": "NOM PRÉNOM ou Raison sociale",
  "trade_name": "Nom commercial si différent",
  "legal_form": "ei",
  "siren": "520181520",
  "siret": "52018152000011",
  "address": "161 Chemin de l'Estanet",
  "postal_code": "30840",
  "city": "Meynes",
  "capital": 10000,
  "rcs": "Nîmes"
}

Analyse le document et retourne le JSON:`

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!(await rateLimit('extract', user.id, { max: 10, windowSeconds: 60 }))) {
      return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter une minute.' }, { status: 429 })
    }

    // Récupérer la clé API Claude
    // D'abord vérifier si l'utilisateur a sa propre clé (BYOK)
    const { data: settings } = await supabase
      .from('user_settings')
      .select('claude_api_key')
      .eq('user_id', user.id)
      .single()

    const apiKey = decryptSecretOrNull(settings?.claude_api_key) || process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Clé API Claude non configurée. Ajoutez votre clé dans les paramètres ou contactez l\'administrateur.',
          needsApiKey: true
        },
        { status: 400 }
      )
    }

    // Récupérer le fichier OU le texte libre, et la cible d'extraction
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const freeText = (formData.get('text') as string | null)?.trim() || null
    const kindRaw = (formData.get('kind') as string | null) ?? 'company'
    const kind: ExtractKind = kindRaw === 'client' || kindRaw === 'invoice' ? kindRaw : 'company'
    const prompt =
      kind === 'client' ? CLIENT_PROMPT : kind === 'invoice' ? INVOICE_PROMPT : EXTRACTION_PROMPT

    if (!file && !freeText) {
      return NextResponse.json({ error: 'Aucun fichier ni texte fourni' }, { status: 400 })
    }

    // Convertir le fichier en buffer (si fichier)
    const bytes = file ? await file.arrayBuffer() : new ArrayBuffer(0)
    let buffer = Buffer.from(bytes)
    let finalMediaType = file?.type ?? ''

    // Compresser les images si nécessaire (limite Claude: 5MB en base64)
    // Base64 augmente la taille d'environ 33%, donc on limite à 3.5 MB binaire
    const MAX_SIZE = 3.5 * 1024 * 1024 // 3.5 MB binaire = ~4.7 MB en base64
    if (file && file.type.startsWith('image/') && buffer.length > MAX_SIZE) {
      try {
        // Compresser avec sharp - réduire fortement pour être sûr
        let compressedBuffer = await sharp(buffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer()

        // Réduire encore si nécessaire
        if (compressedBuffer.length > MAX_SIZE) {
          compressedBuffer = await sharp(buffer)
            .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 50 })
            .toBuffer()
        }

        buffer = Buffer.from(compressedBuffer)
        finalMediaType = 'image/jpeg'
      } catch (compressError) {
        console.error('[EXTRACT] Erreur compression:', compressError)
        return NextResponse.json(
          { error: 'Erreur lors de la compression de l\'image. Essayez avec une image plus petite.' },
          { status: 400 }
        )
      }
    }

    const base64 = buffer.toString('base64')

    // Appeler Claude Vision
    const anthropic = new Anthropic({
      apiKey: apiKey,
    })

    // Construire le contenu : texte libre OU document (PDF / image)
    let content: Anthropic.MessageCreateParams['messages'][0]['content']

    if (!file && freeText) {
      content = [
        {
          type: 'text' as const,
          text: `TEXTE À ANALYSER:\n${freeText}\n\n${prompt}`,
        },
      ]
    } else if (file && file.type === 'application/pdf') {
      // Pour les PDF, utiliser le type "document"
      content = [
        {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: base64,
          },
        },
        {
          type: 'text' as const,
          text: prompt,
        },
      ]
    } else {
      // Pour les images
      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
      if (finalMediaType === 'image/png') mediaType = 'image/png'
      else if (finalMediaType === 'image/webp') mediaType = 'image/webp'
      else if (finalMediaType === 'image/gif') mediaType = 'image/gif'

      content = [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType,
            data: base64,
          },
        },
        {
          type: 'text' as const,
          text: prompt,
        },
      ]
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    })

    // Extraire le JSON de la réponse
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Essayer de parser le JSON
    let extractedData
    try {
      // Nettoyer la réponse (enlever les backticks markdown si présents)
      let jsonStr = responseText.trim()
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7)
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3)
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3)
      }
      jsonStr = jsonStr.trim()

      extractedData = JSON.parse(jsonStr)
    } catch {
      console.error('Error parsing Claude response:', responseText)
      return NextResponse.json(
        { error: 'Impossible d\'extraire les données du document. Essayez avec une image plus claire.' },
        { status: 400 }
      )
    }

    // Valider et nettoyer les données selon la cible
    if (kind === 'client') {
      return NextResponse.json({ success: true, data: cleanClientData(extractedData) })
    }
    if (kind === 'invoice') {
      return NextResponse.json({ success: true, data: cleanInvoiceData(extractedData) })
    }

    const cleanedData: Record<string, unknown> = {}

    if (extractedData.name) cleanedData.name = String(extractedData.name).trim()
    if (extractedData.trade_name) cleanedData.trade_name = String(extractedData.trade_name).trim()

    // Valider la forme juridique
    const validLegalForms = ['auto_entrepreneur', 'ei', 'eurl', 'sarl', 'sasu', 'sas', 'sa', 'association', 'profession_liberale']
    if (extractedData.legal_form && validLegalForms.includes(extractedData.legal_form.toLowerCase())) {
      cleanedData.legal_form = extractedData.legal_form.toLowerCase()
    }

    // Nettoyer le SIRET (garder uniquement les chiffres)
    if (extractedData.siret) {
      const siret = String(extractedData.siret).replace(/\D/g, '')
      if (siret.length === 14) {
        cleanedData.siret = siret
        cleanedData.siren = siret.substring(0, 9)
      }
    }

    // SIREN (si pas déjà extrait du SIRET)
    if (!cleanedData.siren && extractedData.siren) {
      const siren = String(extractedData.siren).replace(/\D/g, '')
      if (siren.length === 9) {
        cleanedData.siren = siren
      }
    }

    if (extractedData.vat_number) cleanedData.vat_number = String(extractedData.vat_number).trim()
    if (extractedData.address) cleanedData.address = String(extractedData.address).trim()

    // Code postal (5 chiffres)
    if (extractedData.postal_code) {
      const postalCode = String(extractedData.postal_code).replace(/\D/g, '')
      if (postalCode.length === 5) {
        cleanedData.postal_code = postalCode
      }
    }

    if (extractedData.city) cleanedData.city = String(extractedData.city).trim()

    // Capital (nombre)
    if (extractedData.capital) {
      const capital = parseFloat(String(extractedData.capital).replace(/[^\d.]/g, ''))
      if (!isNaN(capital) && capital > 0) {
        cleanedData.capital = capital
      }
    }

    if (extractedData.rcs) cleanedData.rcs = String(extractedData.rcs).trim()

    return NextResponse.json({
      success: true,
      data: cleanedData,
    })
  } catch (error) {
    console.error('Error extracting document:', error)

    // Gérer les erreurs spécifiques de l'API Anthropic
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'Clé API Claude invalide', needsApiKey: true },
          { status: 400 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Limite de requêtes atteinte. Réessayez dans quelques instants.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse du document' },
      { status: 500 }
    )
  }
}

// Nettoyage d'une fiche client extraite (texte libre ou document).
function cleanClientData(extracted: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}

  if (extracted.name) cleaned.name = String(extracted.name).trim()
  cleaned.type = extracted.type === 'individual' ? 'individual' : 'professional'
  if (extracted.email && String(extracted.email).includes('@')) {
    cleaned.email = String(extracted.email).trim()
  }
  if (extracted.phone) cleaned.phone = String(extracted.phone).trim()
  if (extracted.address) cleaned.address = String(extracted.address).trim()
  if (extracted.postal_code) {
    const postalCode = String(extracted.postal_code).replace(/\D/g, '')
    if (postalCode.length === 5) cleaned.postal_code = postalCode
  }
  if (extracted.city) cleaned.city = String(extracted.city).trim()
  if (extracted.siret) {
    const siret = String(extracted.siret).replace(/\D/g, '')
    if (siret.length === 14) cleaned.siret = siret
  }
  if (extracted.vat_number) cleaned.vat_number = String(extracted.vat_number).trim()

  return cleaned
}

// Nettoyage des lignes de facture extraites d'une description libre.
function cleanInvoiceData(extracted: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  const validVatRates = [0, 2.1, 5.5, 10, 20]

  if (extracted.client_name) cleaned.client_name = String(extracted.client_name).trim()
  if (extracted.notes) cleaned.notes = String(extracted.notes).trim()

  const rawItems = Array.isArray(extracted.items) ? (extracted.items as unknown[]) : []
  const items = rawItems
    .map((raw) => {
      const item = raw as Record<string, unknown>
      const description = item.description ? String(item.description).trim() : ''
      const quantity = Number(item.quantity ?? 1)
      const unitPrice = Number(item.unit_price)
      const vatRateRaw = Number(item.vat_rate ?? 20)
      const vatRate = validVatRates.includes(vatRateRaw) ? vatRateRaw : 20
      if (!description || !Number.isFinite(unitPrice) || unitPrice <= 0) return null
      return {
        description,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unit_price: unitPrice,
        vat_rate: vatRate,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  cleaned.items = items
  return cleaned
}
