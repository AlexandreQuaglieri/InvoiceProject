import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'

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

    // Récupérer la clé API Claude
    // D'abord vérifier si l'utilisateur a sa propre clé (BYOK)
    const { data: settings } = await supabase
      .from('user_settings')
      .select('claude_api_key')
      .eq('user_id', user.id)
      .single()

    const apiKey = settings?.claude_api_key || process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Clé API Claude non configurée. Ajoutez votre clé dans les paramètres ou contactez l\'administrateur.',
          needsApiKey: true
        },
        { status: 400 }
      )
    }

    // Récupérer le fichier
    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('type') as string

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    // Convertir le fichier en buffer
    const bytes = await file.arrayBuffer()
    let buffer = Buffer.from(bytes)
    let finalMediaType = file.type

    console.log(`[EXTRACT] Fichier reçu: ${file.name}, type: ${file.type}, taille: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)

    // Compresser les images si nécessaire (limite Claude: 5MB en base64)
    // Base64 augmente la taille d'environ 33%, donc on limite à 3.5 MB binaire
    const MAX_SIZE = 3.5 * 1024 * 1024 // 3.5 MB binaire = ~4.7 MB en base64
    if (file.type.startsWith('image/') && buffer.length > MAX_SIZE) {
      console.log(`[EXTRACT] Image trop grande, compression avec sharp...`)

      try {
        // Compresser avec sharp - réduire fortement pour être sûr
        let compressedBuffer = await sharp(buffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer()

        console.log(`[EXTRACT] Après 1ere compression: ${(compressedBuffer.length / 1024 / 1024).toFixed(2)} MB`)

        // Réduire encore si nécessaire
        if (compressedBuffer.length > MAX_SIZE) {
          compressedBuffer = await sharp(buffer)
            .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 50 })
            .toBuffer()
          console.log(`[EXTRACT] Après 2eme compression: ${(compressedBuffer.length / 1024 / 1024).toFixed(2)} MB`)
        }

        buffer = Buffer.from(compressedBuffer)
        finalMediaType = 'image/jpeg'
        console.log(`[EXTRACT] Compression terminée: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)
      } catch (compressError) {
        console.error('[EXTRACT] Erreur compression:', compressError)
        return NextResponse.json(
          { error: 'Erreur lors de la compression de l\'image. Essayez avec une image plus petite.' },
          { status: 400 }
        )
      }
    }

    const base64 = buffer.toString('base64')
    console.log(`[EXTRACT] Base64 généré, taille: ${(base64.length / 1024 / 1024).toFixed(2)} MB`)

    // Appeler Claude Vision
    const anthropic = new Anthropic({
      apiKey: apiKey,
    })

    // Construire le contenu selon le type de fichier
    let content: Anthropic.MessageCreateParams['messages'][0]['content']

    if (file.type === 'application/pdf') {
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
          text: EXTRACTION_PROMPT,
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
          text: EXTRACTION_PROMPT,
        },
      ]
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
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
    } catch (parseError) {
      console.error('Error parsing Claude response:', responseText)
      return NextResponse.json(
        { error: 'Impossible d\'extraire les données du document. Essayez avec une image plus claire.' },
        { status: 400 }
      )
    }

    // Valider et nettoyer les données
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
