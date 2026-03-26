import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

// Rate limiting: 20 requêtes par utilisateur par minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 20) return false
  entry.count++
  return true
}

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans la création de factures, devis et gestion de clients pour une application de facturation française.

Tu aides l'utilisateur à:
1. Créer des factures en langage naturel
2. Créer des devis
3. Créer et gérer des clients
4. Répondre à des questions sur la facturation
5. Rechercher des informations d'entreprises françaises (SIRET, adresse, etc.)

TU AS ACCÈS À DES OUTILS POUR AGIR DIRECTEMENT:
- search_company: Rechercher une entreprise française (SIRET, adresse, etc.)
- create_client: Créer un nouveau client dans la base de données
- create_invoice: Créer une nouvelle facture
- create_quote: Créer un nouveau devis
- update_quote: Modifier le contenu d'un devis existant (lignes, prix, notes, conditions, date de validité)

COMPORTEMENT ATTENDU:
1. Quand l'utilisateur te demande de créer quelque chose, UTILISE L'OUTIL APPROPRIÉ
2. Ne demande pas de confirmation si tu as toutes les informations nécessaires
3. Si des informations manquent, pose des questions pour les obtenir
4. Une fois que tu as toutes les infos, EXÉCUTE L'ACTION avec l'outil

INFORMATIONS REQUISES:

Pour un client:
- Nom (obligatoire)
- Type: "individual" (particulier) ou "professional" (entreprise)
- Adresse, code postal, ville (obligatoires)
- Email (optionnel)
- SIRET (pour les professionnels)

Pour une facture/devis:
- Client (doit exister - utilise son ID ou son nom exact)
- Au moins une ligne avec: description, quantité, prix unitaire
- Taux de TVA (0%, 5.5%, 10%, ou 20%)

IMPORTANT:
- Réponds toujours en français
- Sois concis et pratique
- Quand tu crées quelque chose avec succès, confirme à l'utilisateur avec les détails
- Si une erreur survient, explique clairement le problème`

// Définition des outils pour Claude
const tools: Anthropic.Tool[] = [
  {
    name: 'search_company',
    description:
      "Recherche des informations sur une entreprise française par son nom ou son SIRET. Retourne le nom légal, SIRET, SIREN, adresse, code postal, ville, et numéro de TVA intracommunautaire. Utilise cet outil quand l'utilisateur mentionne une entreprise et veut créer un client professionnel.",
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: "Le nom de l'entreprise ou son numéro SIRET à rechercher",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_client',
    description:
      "Crée un nouveau client dans la base de données. Utilise cet outil quand l'utilisateur veut ajouter un nouveau client.",
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Nom du client ou raison sociale',
        },
        type: {
          type: 'string',
          enum: ['individual', 'professional'],
          description: 'Type de client: individual (particulier) ou professional (entreprise)',
        },
        address: {
          type: 'string',
          description: 'Adresse postale',
        },
        postal_code: {
          type: 'string',
          description: 'Code postal',
        },
        city: {
          type: 'string',
          description: 'Ville',
        },
        country: {
          type: 'string',
          description: 'Pays (par défaut: France)',
        },
        email: {
          type: 'string',
          description: 'Adresse email',
        },
        phone: {
          type: 'string',
          description: 'Numéro de téléphone',
        },
        siret: {
          type: 'string',
          description: 'Numéro SIRET (14 chiffres, pour les professionnels)',
        },
        vat_number: {
          type: 'string',
          description: 'Numéro de TVA intracommunautaire',
        },
      },
      required: ['name', 'type', 'address', 'postal_code', 'city'],
    },
  },
  {
    name: 'create_invoice',
    description:
      "Crée une nouvelle facture pour un client existant. Le client doit déjà exister dans la base.",
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: {
          type: 'string',
          description: 'Nom exact du client (doit correspondre à un client existant)',
        },
        items: {
          type: 'array',
          description: 'Lignes de la facture',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Description de la prestation ou du produit',
              },
              quantity: {
                type: 'number',
                description: 'Quantité',
              },
              unit_price: {
                type: 'number',
                description: 'Prix unitaire HT en euros',
              },
              vat_rate: {
                type: 'number',
                description: 'Taux de TVA en pourcentage (0, 5.5, 10, ou 20)',
              },
            },
            required: ['description', 'quantity', 'unit_price', 'vat_rate'],
          },
        },
        notes: {
          type: 'string',
          description: 'Notes ou conditions particulières',
        },
      },
      required: ['client_name', 'items'],
    },
  },
  {
    name: 'create_quote',
    description:
      "Crée un nouveau devis pour un client existant. Le client doit déjà exister dans la base.",
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: {
          type: 'string',
          description: 'Nom exact du client (doit correspondre à un client existant)',
        },
        items: {
          type: 'array',
          description: 'Lignes du devis',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Description de la prestation ou du produit',
              },
              quantity: {
                type: 'number',
                description: 'Quantité',
              },
              unit_price: {
                type: 'number',
                description: 'Prix unitaire HT en euros',
              },
              tax_rate: {
                type: 'number',
                description: 'Taux de TVA en pourcentage (0, 5.5, 10, ou 20)',
              },
            },
            required: ['description', 'quantity', 'unit_price', 'tax_rate'],
          },
        },
        notes: {
          type: 'string',
          description: 'Notes ou conditions particulières',
        },
      },
      required: ['client_name', 'items'],
    },
  },
  {
    name: 'update_client',
    description:
      "Met à jour les informations d'un client existant. Utilise cet outil quand l'utilisateur veut modifier un client.",
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: {
          type: 'string',
          description: 'Nom actuel du client à modifier',
        },
        name: {
          type: 'string',
          description: 'Nouveau nom du client (optionnel)',
        },
        type: {
          type: 'string',
          enum: ['individual', 'professional'],
          description: 'Nouveau type de client (optionnel)',
        },
        address: {
          type: 'string',
          description: 'Nouvelle adresse postale (optionnel)',
        },
        postal_code: {
          type: 'string',
          description: 'Nouveau code postal (optionnel)',
        },
        city: {
          type: 'string',
          description: 'Nouvelle ville (optionnel)',
        },
        country: {
          type: 'string',
          description: 'Nouveau pays (optionnel)',
        },
        email: {
          type: 'string',
          description: 'Nouvelle adresse email (optionnel)',
        },
        phone: {
          type: 'string',
          description: 'Nouveau numéro de téléphone (optionnel)',
        },
        siret: {
          type: 'string',
          description: 'Nouveau numéro SIRET (optionnel)',
        },
        vat_number: {
          type: 'string',
          description: 'Nouveau numéro de TVA (optionnel)',
        },
      },
      required: ['client_name'],
    },
  },
  {
    name: 'delete_client',
    description:
      "Supprime un client de la base de données. Attention: cette action est irréversible.",
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: {
          type: 'string',
          description: 'Nom du client à supprimer',
        },
      },
      required: ['client_name'],
    },
  },
  {
    name: 'update_invoice_status',
    description:
      "Met à jour le statut d'une facture (brouillon, envoyée, payée, annulée).",
    input_schema: {
      type: 'object' as const,
      properties: {
        invoice_number: {
          type: 'string',
          description: 'Numéro de la facture (ex: FAC-00001)',
        },
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'paid', 'cancelled'],
          description: 'Nouveau statut: draft (brouillon), sent (envoyée), paid (payée), cancelled (annulée)',
        },
      },
      required: ['invoice_number', 'status'],
    },
  },
  {
    name: 'delete_invoice',
    description:
      "Supprime une facture. Ne fonctionne que pour les factures en brouillon.",
    input_schema: {
      type: 'object' as const,
      properties: {
        invoice_number: {
          type: 'string',
          description: 'Numéro de la facture à supprimer',
        },
      },
      required: ['invoice_number'],
    },
  },
  {
    name: 'update_quote_status',
    description:
      "Met à jour le statut d'un devis (brouillon, envoyé, accepté, refusé).",
    input_schema: {
      type: 'object' as const,
      properties: {
        quote_number: {
          type: 'string',
          description: 'Numéro du devis (ex: DEV-00001)',
        },
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'accepted', 'rejected'],
          description: 'Nouveau statut: draft (brouillon), sent (envoyé), accepted (accepté), rejected (refusé)',
        },
      },
      required: ['quote_number', 'status'],
    },
  },
  {
    name: 'delete_quote',
    description:
      "Supprime un devis. Ne fonctionne que pour les devis en brouillon.",
    input_schema: {
      type: 'object' as const,
      properties: {
        quote_number: {
          type: 'string',
          description: 'Numéro du devis à supprimer',
        },
      },
      required: ['quote_number'],
    },
  },
  {
    name: 'update_quote',
    description:
      "Modifie le contenu d'un devis existant en brouillon : lignes, prix, notes, conditions, date de validité. Utilise cet outil quand l'utilisateur veut modifier un devis existant.",
    input_schema: {
      type: 'object' as const,
      properties: {
        quote_number: {
          type: 'string',
          description: 'Numéro du devis à modifier (ex: DEV-2026-001)',
        },
        items: {
          type: 'array',
          description: 'Nouvelles lignes du devis (remplace toutes les lignes existantes si fourni)',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Description de la prestation' },
              quantity: { type: 'number', description: 'Quantité' },
              unit_price: { type: 'number', description: 'Prix unitaire HT en euros' },
              tax_rate: { type: 'number', description: 'Taux de TVA (0, 5.5, 10, ou 20)' },
            },
            required: ['description', 'quantity', 'unit_price', 'tax_rate'],
          },
        },
        notes: {
          type: 'string',
          description: 'Nouvelles notes (remplace les notes existantes si fourni)',
        },
        terms: {
          type: 'string',
          description: 'Nouvelles conditions particulières (remplace les conditions existantes si fourni)',
        },
        validity_date: {
          type: 'string',
          description: 'Nouvelle date de validité au format YYYY-MM-DD',
        },
      },
      required: ['quote_number'],
    },
  },
  {
    name: 'convert_quote_to_invoice',
    description:
      "Convertit un devis accepté en facture.",
    input_schema: {
      type: 'object' as const,
      properties: {
        quote_number: {
          type: 'string',
          description: 'Numéro du devis à convertir en facture',
        },
      },
      required: ['quote_number'],
    },
  },
]

// Fonction pour rechercher une entreprise via l'API gouvernementale
async function searchCompany(query: string): Promise<string> {
  try {
    const cleanQuery = query.trim()
    const isNumeric = /^\d+$/.test(cleanQuery.replace(/\s/g, ''))

    let url: string
    if (isNumeric && cleanQuery.replace(/\s/g, '').length >= 9) {
      const siret = cleanQuery.replace(/\s/g, '')
      url = `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=5`
    } else {
      url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(cleanQuery)}&page=1&per_page=5`
    }

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      return JSON.stringify({ error: 'Erreur lors de la recherche', status: response.status })
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return JSON.stringify({ error: 'Aucune entreprise trouvée', query })
    }

    const results = data.results.slice(0, 5).map((company: {
      nom_complet?: string
      nom_raison_sociale?: string
      siren?: string
      siege?: {
        siret?: string
        adresse?: string
        code_postal?: string
        libelle_commune?: string
      }
    }) => {
      const siege = company.siege || {}
      const siren = company.siren || ''
      const siret = siege.siret || ''

      let vatNumber = ''
      if (siren) {
        const key = (12 + 3 * (parseInt(siren) % 97)) % 97
        vatNumber = `FR${key.toString().padStart(2, '0')}${siren}`
      }

      return {
        name: company.nom_complet || company.nom_raison_sociale || 'Nom inconnu',
        siren,
        siret,
        address: siege.adresse || '',
        postal_code: siege.code_postal || '',
        city: siege.libelle_commune || '',
        vat_number: vatNumber,
      }
    })

    return JSON.stringify({ results, total: data.total_results })
  } catch (error) {
    console.error('Company search error:', error)
    return JSON.stringify({ error: "Erreur lors de la recherche d'entreprise" })
  }
}

// Fonction pour créer un client
async function createClientTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  data: {
    name: string
    type: 'individual' | 'professional'
    address: string
    postal_code: string
    city: string
    country?: string
    email?: string
    phone?: string
    siret?: string
    vat_number?: string
  }
): Promise<string> {
  try {
    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        company_id: companyId,
        name: data.name,
        type: data.type,
        address: data.address,
        postal_code: data.postal_code,
        city: data.city,
        country: data.country || 'France',
        email: data.email || '',
        phone: data.phone || '',
        siret: data.siret || '',
        vat_number: data.vat_number || '',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating client:', error)
      return JSON.stringify({ success: false, error: error.message })
    }

    return JSON.stringify({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        type: client.type,
        address: client.address,
        city: client.city,
      },
    })
  } catch (error) {
    console.error('Error creating client:', error)
    return JSON.stringify({ success: false, error: 'Erreur lors de la création du client' })
  }
}

// Fonction pour créer une facture
async function createInvoiceTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  companyId: string,
  data: {
    client_name: string
    items: Array<{
      description: string
      quantity: number
      unit_price: number
      vat_rate: number
    }>
    notes?: string
  }
): Promise<string> {
  try {
    // Trouver le client par nom
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('company_id', companyId)
      .ilike('name', `%${data.client_name}%`)
      .limit(1)

    if (!clients || clients.length === 0) {
      return JSON.stringify({
        success: false,
        error: `Client "${data.client_name}" non trouvé. Créez d'abord le client.`,
      })
    }

    const client = clients[0]

    // Récupérer le prochain numéro de facture
    const { data: settings } = await supabase
      .from('user_settings')
      .select('invoice_prefix, invoice_next_number')
      .eq('user_id', userId)
      .single()

    const nextNumber = settings?.invoice_next_number || 1
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const invoiceNumber = `${year}${month}${day}-${nextNumber.toString().padStart(2, '0')}`

    // Calculer les totaux
    let subtotal = 0
    let taxAmount = 0
    const itemsWithTotals = data.items.map((item) => {
      const lineTotal = item.quantity * item.unit_price
      const lineTax = lineTotal * (item.vat_rate / 100)
      subtotal += lineTotal
      taxAmount += lineTax
      return {
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate,
        total: lineTotal,
      }
    })

    const total = subtotal + taxAmount
    const issueDate = new Date().toISOString().split('T')[0]
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Créer la facture
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        company_id: companyId,
        client_id: client.id,
        number: invoiceNumber,
        issue_date: issueDate,
        due_date: dueDate,
        status: 'draft',
        total_ht: subtotal,
        total_vat: taxAmount,
        total_ttc: total,
        notes: data.notes || '',
      })
      .select()
      .single()

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError)
      return JSON.stringify({ success: false, error: invoiceError.message })
    }

    // Créer les lignes de facture
    const invoiceItems = itemsWithTotals.map((item, index) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      total_ht: item.total,
      total_vat: item.total * (item.vat_rate / 100),
      total_ttc: item.total * (1 + item.vat_rate / 100),
      position: index,
    }))

    await supabase.from('invoice_items').insert(invoiceItems)

    // Incrémenter le numéro de facture
    await supabase
      .from('user_settings')
      .update({ invoice_next_number: nextNumber + 1 })
      .eq('user_id', userId)

    return JSON.stringify({
      success: true,
      invoice: {
        id: invoice.id,
        number: invoiceNumber,
        client: client.name,
        total: total.toFixed(2),
        status: 'draft',
      },
    })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return JSON.stringify({ success: false, error: 'Erreur lors de la création de la facture' })
  }
}

// Fonction pour créer un devis
async function createQuoteTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  companyId: string,
  data: {
    client_name: string
    items: Array<{
      description: string
      quantity: number
      unit_price: number
      tax_rate: number
    }>
    notes?: string
  }
): Promise<string> {
  try {
    // Trouver le client par nom
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('company_id', companyId)
      .ilike('name', `%${data.client_name}%`)
      .limit(1)

    if (!clients || clients.length === 0) {
      return JSON.stringify({
        success: false,
        error: `Client "${data.client_name}" non trouvé. Créez d'abord le client.`,
      })
    }

    const client = clients[0]

    // Générer le numéro de devis
    const { count } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)

    const currentYear = new Date().getFullYear()
    const quoteNumber = `DEV-${currentYear}-${((count || 0) + 1).toString().padStart(3, '0')}`

    // Calculer les totaux
    let subtotal = 0
    let taxAmount = 0
    const itemsWithTotals = data.items.map((item) => {
      const lineTotal = item.quantity * item.unit_price
      const lineTax = lineTotal * (item.tax_rate / 100)
      subtotal += lineTotal
      taxAmount += lineTax
      return {
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        total: lineTotal,
      }
    })

    const total = subtotal + taxAmount
    const issueDate = new Date().toISOString().split('T')[0]
    const validityDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Créer le devis
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        user_id: userId,
        company_id: companyId,
        client_id: client.id,
        quote_number: quoteNumber,
        issue_date: issueDate,
        validity_date: validityDate,
        status: 'draft',
        subtotal,
        tax_amount: taxAmount,
        total,
        notes: data.notes || '',
      })
      .select()
      .single()

    if (quoteError) {
      console.error('Error creating quote:', quoteError)
      return JSON.stringify({ success: false, error: quoteError.message })
    }

    // Créer les lignes du devis
    const quoteItems = itemsWithTotals.map((item) => ({
      quote_id: quote.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      total: item.total,
    }))

    await supabase.from('quote_items').insert(quoteItems)

    return JSON.stringify({
      success: true,
      quote: {
        id: quote.id,
        number: quoteNumber,
        client: client.name,
        total: total.toFixed(2),
        status: 'draft',
      },
    })
  } catch (error) {
    console.error('Error creating quote:', error)
    return JSON.stringify({ success: false, error: 'Erreur lors de la création du devis' })
  }
}

// Fonction pour mettre à jour un client
async function updateClientTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  data: {
    client_name: string
    name?: string
    type?: 'individual' | 'professional'
    address?: string
    postal_code?: string
    city?: string
    country?: string
    email?: string
    phone?: string
    siret?: string
    vat_number?: string
  }
): Promise<string> {
  try {
    // Trouver le client
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .ilike('name', `%${data.client_name}%`)
      .limit(1)

    if (!clients || clients.length === 0) {
      return JSON.stringify({
        success: false,
        error: `Client "${data.client_name}" non trouvé.`,
      })
    }

    const client = clients[0]

    // Construire l'objet de mise à jour
    const updateData: Record<string, string> = {}
    if (data.name) updateData.name = data.name
    if (data.type) updateData.type = data.type
    if (data.address) updateData.address = data.address
    if (data.postal_code) updateData.postal_code = data.postal_code
    if (data.city) updateData.city = data.city
    if (data.country) updateData.country = data.country
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.siret !== undefined) updateData.siret = data.siret
    if (data.vat_number !== undefined) updateData.vat_number = data.vat_number

    if (Object.keys(updateData).length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Aucune modification spécifiée.',
      })
    }

    const { error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', client.id)

    if (error) {
      return JSON.stringify({ success: false, error: error.message })
    }

    return JSON.stringify({
      success: true,
      client: {
        id: client.id,
        name: data.name || client.name,
        updated_fields: Object.keys(updateData),
      },
    })
  } catch (error) {
    console.error('Error updating client:', error)
    return JSON.stringify({ success: false, error: 'Erreur lors de la mise à jour du client' })
  }
}

// Fonction pour supprimer un client
async function deleteClientTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  clientName: string
): Promise<string> {
  try {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('company_id', companyId)
      .ilike('name', `%${clientName}%`)
      .limit(1)

    if (!clients || clients.length === 0) {
      return JSON.stringify({
        success: false,
        error: `Client "${clientName}" non trouvé.`,
      })
    }

    const client = clients[0]

    // Vérifier s'il y a des factures ou devis liés
    const { count: invoiceCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id)

    const { count: quoteCount } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id)

    if ((invoiceCount || 0) > 0 || (quoteCount || 0) > 0) {
      return JSON.stringify({
        success: false,
        error: `Impossible de supprimer "${client.name}": il a ${invoiceCount || 0} facture(s) et ${quoteCount || 0} devis liés.`,
      })
    }

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', client.id)

    if (error) {
      return JSON.stringify({ success: false, error: error.message })
    }

    return JSON.stringify({
      success: true,
      message: `Client "${client.name}" supprimé.`,
    })
  } catch (error) {
    console.error('Error deleting client:', error)
    return JSON.stringify({ success: false, error: 'Erreur lors de la suppression du client' })
  }
}

// Fonction pour mettre à jour le statut d'une facture
async function updateInvoiceStatusTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  invoiceNumber: string,
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
): Promise<string> {
  try {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, number, status')
      .eq('company_id', companyId)
      .ilike('number', `%${invoiceNumber}%`)
      .limit(1)

    if (!invoices || invoices.length === 0) {
      return JSON.stringify({
        success: false,
        error: `Facture "${invoiceNumber}" non trouvée.`,
      })
    }

    const invoice = invoices[0]

    const { error } = await supabase
      .from('invoices')
      .update({ status })
      .eq('id', invoice.id)

    if (error) {
      return JSON.stringify({ success: false, error: error.message })
    }

    const statusLabels: Record<string, string> = {
      draft: 'brouillon',
      sent: 'envoyée',
      paid: 'payée',
      cancelled: 'annulée',
    }

    return JSON.stringify({
      success: true,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        old_status: invoice.status,
        new_status: status,
        message: `Facture ${invoice.number} marquée comme ${statusLabels[status]}.`,
      },
    })
  } catch (error) {
    console.error('Error updating invoice:', error)
    return JSON.stringify({ success: false, error: 'Erreur lors de la mise à jour de la facture' })
  }
}

// Fonction pour supprimer une facture
async function deleteInvoiceTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  invoiceNumber: string
): Promise<string> {
  try {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, number, status')
      .eq('company_id', companyId)
      .ilike('number', `%${invoiceNumber}%`)
      .limit(1)

    if (!invoices || invoices.length === 0) {
      return JSON.stringify({
        success: false,
        error: `Facture "${invoiceNumber}" non trouvée.`,
      })
    }

    const invoice = invoices[0]

    if (invoice.status !== 'draft') {
      return JSON.stringify({
        success: false,
        error: `Impossible de supprimer la facture ${invoice.number}: elle n'est pas en brouillon (statut actuel: ${invoice.status}).`,
      })
    }

    // Supprimer les lignes puis la facture
    await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id)
    const { error } = await supabase.from('invoices').delete().eq('id', invoice.id)

    if (error) {
      return JSON.stringify({ success: false, error: error.message })
    }

    return JSON.stringify({
      success: true,
      message: `Facture ${invoice.number} supprimée.`,
    })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return JSON.stringify({ success: false, error: 'Erreur lors de la suppression de la facture' })
  }
}

// Fonction pour mettre à jour le statut d'un devis
async function updateQuoteStatusTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  quoteNumber: string,
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
): Promise<string> {
  try {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, quote_number, status')
      .eq('company_id', companyId)
      .ilike('quote_number', `%${quoteNumber}%`)
      .limit(1)

    if (!quotes || quotes.length === 0) {
      return JSON.stringify({
        success: false,
        error: `Devis "${quoteNumber}" non trouvé.`,
      })
    }

    const quote = quotes[0]

    const { error } = await supabase
      .from('quotes')
      .update({ status })
      .eq('id', quote.id)

    if (error) {
      return JSON.stringify({ success: false, error: error.message })
    }

    const statusLabels: Record<string, string> = {
      draft: 'brouillon',
      sent: 'envoyé',
      accepted: 'accepté',
      rejected: 'refusé',
    }

    return JSON.stringify({
      success: true,
      quote: {
        id: quote.id,
        number: quote.quote_number,
        old_status: quote.status,
        new_status: status,
        message: `Devis ${quote.quote_number} marqué comme ${statusLabels[status]}.`,
      },
    })
  } catch (error) {
    console.error('Error updating quote:', error)
    return JSON.stringify({ success: false, error: 'Erreur lors de la mise à jour du devis' })
  }
}

// Fonction pour supprimer un devis
async function deleteQuoteTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  quoteNumber: string
): Promise<string> {
  try {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, quote_number, status')
      .eq('company_id', companyId)
      .ilike('quote_number', `%${quoteNumber}%`)
      .limit(1)

    if (!quotes || quotes.length === 0) {
      return JSON.stringify({
        success: false,
        error: `Devis "${quoteNumber}" non trouvé.`,
      })
    }

    const quote = quotes[0]

    if (quote.status !== 'draft') {
      return JSON.stringify({
        success: false,
        error: `Impossible de supprimer le devis ${quote.quote_number}: il n'est pas en brouillon (statut actuel: ${quote.status}).`,
      })
    }

    await supabase.from('quote_items').delete().eq('quote_id', quote.id)
    const { error } = await supabase.from('quotes').delete().eq('id', quote.id)

    if (error) {
      return JSON.stringify({ success: false, error: error.message })
    }

    return JSON.stringify({
      success: true,
      message: `Devis ${quote.quote_number} supprimé.`,
    })
  } catch (error) {
    console.error('Error deleting quote:', error)
    return JSON.stringify({ success: false, error: 'Erreur lors de la suppression du devis' })
  }
}

// Fonction pour modifier un devis
async function updateQuoteTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  companyId: string,
  data: {
    quote_number: string
    items?: Array<{ description: string; quantity: number; unit_price: number; tax_rate: number }>
    notes?: string
    terms?: string
    validity_date?: string
  }
): Promise<string> {
  try {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, quote_number, status, client_id, issue_date, validity_date, notes, terms')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .ilike('quote_number', `%${data.quote_number}%`)
      .limit(1)

    if (!quotes || quotes.length === 0) {
      return JSON.stringify({ success: false, error: `Devis "${data.quote_number}" non trouvé.` })
    }

    const quote = quotes[0]

    if (quote.status !== 'draft') {
      return JSON.stringify({
        success: false,
        error: `Le devis ${quote.quote_number} est en statut "${quote.status}" et ne peut plus être modifié. Seuls les brouillons sont modifiables.`,
      })
    }

    // Recalculer les totaux si des lignes sont fournies
    let updateData: Record<string, unknown> = {}

    if (data.items && data.items.length > 0) {
      let subtotal = 0
      let taxAmount = 0
      const itemsWithTotals = data.items.map((item, index) => {
        const lineTotal = item.quantity * item.unit_price
        const lineTax = lineTotal * (item.tax_rate / 100)
        subtotal += lineTotal
        taxAmount += lineTax
        return { ...item, total: lineTotal, position: index }
      })

      // Supprimer les anciennes lignes et recréer
      await supabase.from('quote_items').delete().eq('quote_id', quote.id)
      await supabase.from('quote_items').insert(
        itemsWithTotals.map((item) => ({
          quote_id: quote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          total: item.total,
          position: item.position,
        }))
      )

      updateData.subtotal = subtotal
      updateData.tax_amount = taxAmount
      updateData.total = subtotal + taxAmount
    }

    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.terms !== undefined) updateData.terms = data.terms
    if (data.validity_date) updateData.validity_date = data.validity_date

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.from('quotes').update(updateData).eq('id', quote.id)
      if (error) return JSON.stringify({ success: false, error: error.message })
    }

    return JSON.stringify({
      success: true,
      quote: {
        id: quote.id,
        number: quote.quote_number,
        total: updateData.total ? (updateData.total as number).toFixed(2) : undefined,
        message: `Devis ${quote.quote_number} mis à jour avec succès.`,
      },
    })
  } catch (error) {
    console.error('Error updating quote:', error)
    return JSON.stringify({ success: false, error: 'Erreur lors de la modification du devis' })
  }
}

// Fonction pour convertir un devis en facture
async function convertQuoteToInvoiceTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  companyId: string,
  quoteNumber: string
): Promise<string> {
  try {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('company_id', companyId)
      .ilike('quote_number', `%${quoteNumber}%`)
      .limit(1)

    if (!quotes || quotes.length === 0) {
      return JSON.stringify({
        success: false,
        error: `Devis "${quoteNumber}" non trouvé.`,
      })
    }

    const quote = quotes[0]

    if (quote.status === 'converted') {
      return JSON.stringify({
        success: false,
        error: `Le devis ${quote.quote_number} a déjà été converti en facture.`,
      })
    }

    // Récupérer le prochain numéro de facture
    const { data: settings } = await supabase
      .from('user_settings')
      .select('invoice_prefix, invoice_next_number')
      .eq('user_id', userId)
      .single()

    const nextNumber = settings?.invoice_next_number || 1
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const invoiceNumber = `${year}${month}${day}-${nextNumber.toString().padStart(2, '0')}`

    const issueDate = now.toISOString().split('T')[0]
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Créer la facture
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        company_id: companyId,
        client_id: quote.client_id,
        number: invoiceNumber,
        issue_date: issueDate,
        due_date: dueDate,
        status: 'draft',
        total_ht: quote.subtotal,
        total_vat: quote.tax_amount,
        total_ttc: quote.total,
        notes: quote.notes || '',
      })
      .select()
      .single()

    if (invoiceError) {
      return JSON.stringify({ success: false, error: invoiceError.message })
    }

    // Copier les lignes
    const invoiceItems = quote.quote_items.map((item: { description: string; quantity: number; unit_price: number; tax_rate: number; total: number; position: number }, index: number) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.tax_rate,
      total_ht: item.total,
      total_vat: item.total * (item.tax_rate / 100),
      total_ttc: item.total * (1 + item.tax_rate / 100),
      position: item.position || index,
    }))

    await supabase.from('invoice_items').insert(invoiceItems)

    // Mettre à jour le devis
    await supabase
      .from('quotes')
      .update({ status: 'converted', converted_invoice_id: invoice.id })
      .eq('id', quote.id)

    // Incrémenter le numéro de facture
    await supabase
      .from('user_settings')
      .update({ invoice_next_number: nextNumber + 1 })
      .eq('user_id', userId)

    return JSON.stringify({
      success: true,
      invoice: {
        id: invoice.id,
        number: invoiceNumber,
        from_quote: quote.quote_number,
        total: quote.total.toFixed(2),
      },
    })
  } catch (error) {
    console.error('Error converting quote:', error)
    return JSON.stringify({ success: false, error: 'Erreur lors de la conversion du devis' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Veuillez patienter une minute.' },
        { status: 429 }
      )
    }

    // Récupérer la clé API Claude
    const { data: settings } = await supabase
      .from('user_settings')
      .select('claude_api_key')
      .eq('user_id', user.id)
      .single()

    const apiKey = settings?.claude_api_key || process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Clé API Claude non configurée',
          needsApiKey: true,
        },
        { status: 400 }
      )
    }

    // Récupérer l'entreprise et les clients pour contexte
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, vat_regime')
      .eq('user_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json(
        { error: "Vous devez d'abord configurer votre entreprise" },
        { status: 400 }
      )
    }

    let clientsContext = ''
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('company_id', company.id)
      .limit(50)

    if (clients && clients.length > 0) {
      clientsContext = `\n\nClients existants dans la base:\n${clients.map((c) => `- ${c.name}`).join('\n')}`
    } else {
      clientsContext = "\n\nAucun client n'existe encore. Tu peux en créer un avec l'outil create_client."
    }

    if (company.vat_regime === 'franchise') {
      clientsContext +=
        '\n\nNote: L\'utilisateur est en franchise de TVA (exonéré), donc le taux de TVA est toujours 0%.'
    }

    const body = await request.json()
    const { messages } = body

    const anthropic = new Anthropic({ apiKey })

    // Première requête avec les outils
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT + clientsContext,
      tools,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    // Boucle pour gérer les appels d'outils
    const conversationMessages: Anthropic.MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })
    )

    // Stocker les actions exécutées pour le frontend
    const executedActions: Array<{
      type: string
      success: boolean
      data?: Record<string, unknown>
      error?: string
    }> = []

    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      )

      conversationMessages.push({
        role: 'assistant',
        content: response.content,
      })

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        let result: string

        switch (toolUse.name) {
          case 'search_company': {
            const input = toolUse.input as { query: string }
            result = await searchCompany(input.query)
            break
          }
          case 'create_client': {
            const input = toolUse.input as {
              name: string
              type: 'individual' | 'professional'
              address: string
              postal_code: string
              city: string
              country?: string
              email?: string
              phone?: string
              siret?: string
              vat_number?: string
            }
            result = await createClientTool(supabase, company.id, input)
            const parsed = JSON.parse(result)
            executedActions.push({
              type: 'create_client',
              success: parsed.success,
              data: parsed.client,
              error: parsed.error,
            })
            break
          }
          case 'create_invoice': {
            const input = toolUse.input as {
              client_name: string
              items: Array<{
                description: string
                quantity: number
                unit_price: number
                vat_rate: number
              }>
              notes?: string
            }
            result = await createInvoiceTool(supabase, user.id, company.id, input)
            const parsed = JSON.parse(result)
            executedActions.push({
              type: 'create_invoice',
              success: parsed.success,
              data: parsed.invoice,
              error: parsed.error,
            })
            break
          }
          case 'create_quote': {
            const input = toolUse.input as {
              client_name: string
              items: Array<{
                description: string
                quantity: number
                unit_price: number
                tax_rate: number
              }>
              notes?: string
            }
            result = await createQuoteTool(supabase, user.id, company.id, input)
            const parsed = JSON.parse(result)
            executedActions.push({
              type: 'create_quote',
              success: parsed.success,
              data: parsed.quote,
              error: parsed.error,
            })
            break
          }
          case 'update_client': {
            const input = toolUse.input as {
              client_name: string
              name?: string
              type?: 'individual' | 'professional'
              address?: string
              postal_code?: string
              city?: string
              country?: string
              email?: string
              phone?: string
              siret?: string
              vat_number?: string
            }
            result = await updateClientTool(supabase, company.id, input)
            const parsed = JSON.parse(result)
            executedActions.push({
              type: 'update_client',
              success: parsed.success,
              data: parsed.client,
              error: parsed.error,
            })
            break
          }
          case 'delete_client': {
            const input = toolUse.input as { client_name: string }
            result = await deleteClientTool(supabase, company.id, input.client_name)
            const parsed = JSON.parse(result)
            executedActions.push({
              type: 'delete_client',
              success: parsed.success,
              data: { message: parsed.message },
              error: parsed.error,
            })
            break
          }
          case 'update_invoice_status': {
            const input = toolUse.input as {
              invoice_number: string
              status: 'draft' | 'sent' | 'paid' | 'cancelled'
            }
            result = await updateInvoiceStatusTool(supabase, company.id, input.invoice_number, input.status)
            const parsed = JSON.parse(result)
            executedActions.push({
              type: 'update_invoice_status',
              success: parsed.success,
              data: parsed.invoice,
              error: parsed.error,
            })
            break
          }
          case 'delete_invoice': {
            const input = toolUse.input as { invoice_number: string }
            result = await deleteInvoiceTool(supabase, company.id, input.invoice_number)
            const parsed = JSON.parse(result)
            executedActions.push({
              type: 'delete_invoice',
              success: parsed.success,
              data: { message: parsed.message },
              error: parsed.error,
            })
            break
          }
          case 'update_quote_status': {
            const input = toolUse.input as {
              quote_number: string
              status: 'draft' | 'sent' | 'accepted' | 'rejected'
            }
            result = await updateQuoteStatusTool(supabase, company.id, input.quote_number, input.status)
            const parsed = JSON.parse(result)
            executedActions.push({
              type: 'update_quote_status',
              success: parsed.success,
              data: parsed.quote,
              error: parsed.error,
            })
            break
          }
          case 'update_quote': {
            const input = toolUse.input as {
              quote_number: string
              items?: Array<{ description: string; quantity: number; unit_price: number; tax_rate: number }>
              notes?: string
              terms?: string
              validity_date?: string
            }
            result = await updateQuoteTool(supabase, user.id, company.id, input)
            const parsed = JSON.parse(result)
            executedActions.push({
              type: 'update_quote_status',
              success: parsed.success,
              data: parsed.quote,
              error: parsed.error,
            })
            break
          }
          case 'delete_quote': {
            const input = toolUse.input as { quote_number: string }
            result = await deleteQuoteTool(supabase, company.id, input.quote_number)
            const parsed = JSON.parse(result)
            executedActions.push({
              type: 'delete_quote',
              success: parsed.success,
              data: { message: parsed.message },
              error: parsed.error,
            })
            break
          }
          case 'convert_quote_to_invoice': {
            const input = toolUse.input as { quote_number: string }
            result = await convertQuoteToInvoiceTool(supabase, user.id, company.id, input.quote_number)
            const parsed = JSON.parse(result)
            executedActions.push({
              type: 'convert_quote_to_invoice',
              success: parsed.success,
              data: parsed.invoice,
              error: parsed.error,
            })
            break
          }
          default:
            result = JSON.stringify({ error: 'Outil inconnu' })
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        })
      }

      conversationMessages.push({
        role: 'user',
        content: toolResults,
      })

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT + clientsContext,
        tools,
        messages: conversationMessages,
      })
    }

    // Extraire le texte de la réponse finale
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    const responseText = textBlock?.text || ''

    return NextResponse.json({
      message: responseText,
      executedActions,
    })
  } catch (error) {
    console.error('Chat error:', error)

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'Clé API Claude invalide', needsApiKey: true },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ error: 'Erreur lors de la conversation' }, { status: 500 })
  }
}
