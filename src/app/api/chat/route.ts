import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { decryptSecretOrNull } from '@/lib/crypto'
import * as svc from '@/lib/services'
import type { InvoiceStatus, QuoteStatus } from '@/types/database'
import sharp from 'sharp'

// Construit un chemin de navigation sûr à partir d'une destination connue.
// L'assistant ne fournit jamais d'URL libre : on mappe une destination contrôlée.
function navPath(destination: string, id?: string): string | null {
  switch (destination) {
    case 'dashboard':
      return '/dashboard'
    case 'invoices':
      return '/invoices'
    case 'invoices_overdue':
      return '/invoices?status=overdue'
    case 'quotes':
      return '/quotes'
    case 'clients':
      return '/clients'
    case 'company':
      return '/company'
    case 'settings':
      return '/settings'
    case 'invoice_detail':
      return id ? `/invoices/${id}` : null
    case 'quote_detail':
      return id ? `/quotes/${id}` : null
    default:
      return null
  }
}

// Pièce jointe reçue du frontend (base64 sans préfixe data:).
type IncomingAttachment = { name?: string; media_type: string; data: string }

// Transforme les pièces jointes (PDF/images) en blocs de contenu multimodal pour Claude.
// Les images trop lourdes sont compressées avec sharp (limite Claude ~5 Mo en base64).
// Les formats non supportés par la vision (Word, Excel...) sont ignorés.
async function buildAttachmentBlocks(
  attachments: IncomingAttachment[]
): Promise<Anthropic.ContentBlockParam[]> {
  const blocks: Anthropic.ContentBlockParam[] = []
  const MAX_IMAGE = 3.5 * 1024 * 1024 // ~4.7 Mo en base64

  for (const att of attachments) {
    if (att.media_type === 'application/pdf') {
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: att.data },
      })
    } else if (att.media_type.startsWith('image/')) {
      let buffer = Buffer.from(att.data, 'base64')
      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
        att.media_type === 'image/png'
          ? 'image/png'
          : att.media_type === 'image/webp'
            ? 'image/webp'
            : att.media_type === 'image/gif'
              ? 'image/gif'
              : 'image/jpeg'

      if (buffer.length > MAX_IMAGE) {
        let compressed = await sharp(buffer)
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer()
        if (compressed.length > MAX_IMAGE) {
          compressed = await sharp(buffer)
            .resize(1100, 1100, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 55 })
            .toBuffer()
        }
        buffer = Buffer.from(compressed)
        mediaType = 'image/jpeg'
      }

      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
      })
    }
  }

  return blocks
}

// Rate limiting : 20 requêtes par utilisateur par minute (persistant, src/lib/rate-limit.ts)

const SYSTEM_PROMPT = `Tu es le copilote de Factur-IA, une application de facturation française. Tu n'es pas qu'un exécuteur d'actions : tu ACCOMPAGNES l'utilisateur — tu expliques, tu conseilles ET tu agis.

TON RÔLE
- Aider à créer et gérer factures, devis et clients.
- Répondre aux questions sur l'activité de l'utilisateur (CA, impayés, détails...).
- Expliquer le fonctionnement de l'application et accompagner la prise en main.
- Conseiller sur la facturation française (mentions légales, TVA, délais) et la facturation électronique obligatoire 2026.

TES OUTILS
- Actions : search_company, create_client, update_client, delete_client, create_invoice, update_invoice_status, delete_invoice, create_quote, update_quote, update_quote_status, delete_quote, convert_quote_to_invoice.
- Consultation (lecture seule) : get_invoice_stats, list_invoices, get_invoice, list_quotes, get_quote, list_clients, get_company.
- Connaissance : get_guide(topic) — fiches de référence fiables sur le métier et l'app. Sujets : mentions_obligatoires, tva, delais_paiement, facturation_electronique_2026, chorus_pro, app_demarrage, app_fonctionnalites.
- Navigation : navigate(destination, label) — propose un bouton pour ouvrir un écran (facture, devis, liste, tableau de bord, paramètres). L'utilisateur garde la main sur le clic.

COMMENT TE COMPORTER
1. Question sur SES données (CA, factures en retard, détail d'un devis, top client...) → utilise d'abord les outils de CONSULTATION, puis réponds clairement (montants en euros).
2. Question métier, légale ou sur l'application → appuie-toi sur get_guide (n'invente JAMAIS une règle ni une date), puis explique simplement, avec pédagogie.
3. Demande de création / modification → si tu as toutes les infos, AGIS avec l'outil ; sinon pose les questions manquantes.
4. CONFIRME TOUJOURS avant une action destructive ou externe : suppression (client, facture, devis) et transmission à Chorus Pro. Récapitule ce que tu vas faire et attends l'accord explicite.
5. Après une action réussie, confirme avec un récap clair (numéro, client, montant TTC, échéance) et propose la suite logique si c'est pertinent.
6. Quand c'est utile, propose d'ouvrir le bon écran avec navigate (ex. après avoir créé une facture pour la voir, ou si l'utilisateur demande « montre-moi mes impayés »). C'est une simple suggestion cliquable ; ne l'utilise jamais pour une action sensible.
7. Si l'utilisateur joint un document (PDF ou image, ex. une plaquette), LIS-le pour en extraire les informations utiles (prestations, prix, coordonnées du client...). Si des informations nécessaires manquent (client, adresse, taux de TVA...), demande-les avant de créer le devis ou la facture.

STYLE
- Toujours en français, ton chaleureux et professionnel, concis mais pédagogue.
- Montants en euros. Mets en avant la valeur (gain de temps, conformité) quand c'est utile.
- Si une erreur survient, explique clairement le problème et la marche à suivre.

INFORMATIONS REQUISES
- Client : nom (obligatoire), type "individual" (particulier) ou "professional" (entreprise), adresse + code postal + ville (obligatoires), email (optionnel), SIRET (pour les professionnels).
- Facture / devis : un client existant (par son nom exact), au moins une ligne (description, quantité, prix unitaire HT), taux de TVA (0, 5.5, 10 ou 20).`

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
  {
    name: 'get_invoice_stats',
    description:
      "Statistiques de facturation : chiffre d'affaires encaissé (mois et année), montant en attente, et répartition des factures par statut. Utilise cet outil pour « combien j'ai facturé ce mois ? », « combien on me doit ? ».",
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'list_invoices',
    description:
      "Liste les factures de l'utilisateur (filtres optionnels). Pour « mes factures en retard », « les factures de Client X », « mes dernières factures ».",
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
          description: 'Filtrer par statut',
        },
        client_name: { type: 'string', description: 'Filtrer par nom de client' },
        limit: { type: 'number', description: 'Nombre maximum de résultats' },
      },
    },
  },
  {
    name: 'get_invoice',
    description: "Récupère le détail complet d'une facture (lignes incluses) par son numéro.",
    input_schema: {
      type: 'object' as const,
      properties: {
        invoice_number: { type: 'string', description: 'Numéro de la facture (ex: 20260605-01)' },
      },
      required: ['invoice_number'],
    },
  },
  {
    name: 'list_quotes',
    description: "Liste les devis de l'utilisateur (filtre optionnel par statut).",
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'],
          description: 'Filtrer par statut',
        },
        limit: { type: 'number', description: 'Nombre maximum de résultats' },
      },
    },
  },
  {
    name: 'get_quote',
    description: "Récupère le détail complet d'un devis (lignes incluses) par son numéro.",
    input_schema: {
      type: 'object' as const,
      properties: {
        quote_number: { type: 'string', description: 'Numéro du devis (ex: D-2026-001)' },
      },
      required: ['quote_number'],
    },
  },
  {
    name: 'list_clients',
    description: "Liste les clients de l'utilisateur (recherche optionnelle par nom ou email).",
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Rechercher par nom ou email' },
        limit: { type: 'number', description: 'Nombre maximum de résultats' },
      },
    },
  },
  {
    name: 'get_company',
    description:
      "Informations de l'entreprise de l'utilisateur (raison sociale, SIRET, TVA, adresse, coordonnées bancaires).",
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_guide',
    description:
      "Fiche de référence fiable sur la facturation française et le fonctionnement de l'application. Utilise cet outil AVANT de répondre à une question métier, légale ou sur l'app (ne jamais inventer de règle ni de date).",
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          enum: [
            'mentions_obligatoires',
            'tva',
            'delais_paiement',
            'facturation_electronique_2026',
            'chorus_pro',
            'app_demarrage',
            'app_fonctionnalites',
          ],
          description: 'Le sujet de la fiche de référence',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'navigate',
    description:
      "Propose à l'utilisateur d'ouvrir un écran de l'application : un bouton cliquable s'affiche, l'utilisateur reste maître du clic (aucune navigation automatique). Utilise-le pour aider à atteindre la bonne page (détail d'une facture/d'un devis, liste filtrée, tableau de bord, paramètres). N'utilise PAS la navigation pour des actions sensibles.",
    input_schema: {
      type: 'object' as const,
      properties: {
        destination: {
          type: 'string',
          enum: [
            'dashboard',
            'invoices',
            'invoices_overdue',
            'quotes',
            'clients',
            'company',
            'settings',
            'invoice_detail',
            'quote_detail',
          ],
          description:
            "L'écran à ouvrir. invoice_detail et quote_detail nécessitent un id (récupérable via les outils de consultation).",
        },
        id: {
          type: 'string',
          description: "ID de la facture ou du devis (requis pour invoice_detail / quote_detail)",
        },
        label: {
          type: 'string',
          description:
            "Texte du bouton, court et explicite (ex: « Ouvrir la facture 20260605-01 », « Voir mes impayés »)",
        },
      },
      required: ['destination', 'label'],
    },
  },
]

// Fonction pour rechercher une entreprise via l'API gouvernementale
async function searchCompany(query: string): Promise<string> {
  return JSON.stringify(await svc.company.searchCompany(query))
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
  const r = await svc.clients.create(supabase, { userId: '', companyId }, data)
  if (!r.ok) return JSON.stringify({ success: false, error: r.error })
  return JSON.stringify({
    success: true,
    client: {
      id: r.data.id,
      name: r.data.name,
      type: r.data.type,
      address: r.data.address,
      city: r.data.city,
    },
  })
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
  const ctx = { userId, companyId }
  const client = await svc.clients.findByName(supabase, ctx, data.client_name)
  if (!client.ok) {
    return JSON.stringify({
      success: false,
      error: `Client "${data.client_name}" non trouvé. Créez d'abord le client.`,
    })
  }
  const r = await svc.invoices.create(supabase, ctx, {
    client_id: client.data.id,
    items: data.items,
    notes: data.notes,
  })
  if (!r.ok) return JSON.stringify({ success: false, error: r.error })
  return JSON.stringify({
    success: true,
    invoice: {
      id: r.data.id,
      number: r.data.number,
      client: r.data.clientName,
      total: r.data.total_ttc.toFixed(2),
      status: 'draft',
    },
  })
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
  const ctx = { userId, companyId }
  const client = await svc.clients.findByName(supabase, ctx, data.client_name)
  if (!client.ok) {
    return JSON.stringify({
      success: false,
      error: `Client "${data.client_name}" non trouvé. Créez d'abord le client.`,
    })
  }
  const r = await svc.quotes.create(supabase, ctx, {
    client_id: client.data.id,
    items: data.items,
    notes: data.notes,
  })
  if (!r.ok) return JSON.stringify({ success: false, error: r.error })
  return JSON.stringify({
    success: true,
    quote: {
      id: r.data.id,
      number: r.data.quote_number,
      client: r.data.clientName,
      total: r.data.total.toFixed(2),
      status: 'draft',
    },
  })
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
  const ctx = { userId: '', companyId }
  const client = await svc.clients.findByName(supabase, ctx, data.client_name)
  if (!client.ok) {
    return JSON.stringify({ success: false, error: `Client "${data.client_name}" non trouvé.` })
  }
  // svc.clients.update ignore client_name : seuls les champs connus sont appliqués.
  const r = await svc.clients.update(supabase, ctx, client.data.id, data)
  if (!r.ok) return JSON.stringify({ success: false, error: r.error })
  return JSON.stringify({
    success: true,
    client: {
      id: r.data.id,
      name: r.data.name,
      updated_fields: r.data.updatedFields,
    },
  })
}

// Fonction pour supprimer un client
async function deleteClientTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  clientName: string
): Promise<string> {
  const ctx = { userId: '', companyId }
  const client = await svc.clients.findByName(supabase, ctx, clientName)
  if (!client.ok) {
    return JSON.stringify({ success: false, error: `Client "${clientName}" non trouvé.` })
  }
  const r = await svc.clients.remove(supabase, ctx, client.data.id)
  if (!r.ok) return JSON.stringify({ success: false, error: r.error })
  return JSON.stringify({ success: true, message: `Client "${r.data.name}" supprimé.` })
}

// Fonction pour mettre à jour le statut d'une facture
async function updateInvoiceStatusTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  invoiceNumber: string,
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
): Promise<string> {
  const ctx = { userId: '', companyId }
  const inv = await svc.invoices.findByNumber(supabase, ctx, invoiceNumber)
  if (!inv.ok) {
    return JSON.stringify({ success: false, error: `Facture "${invoiceNumber}" non trouvée.` })
  }
  const r = await svc.invoices.setStatus(supabase, ctx, inv.data.id, status)
  if (!r.ok) return JSON.stringify({ success: false, error: r.error })
  const statusLabels: Record<string, string> = {
    draft: 'brouillon',
    sent: 'envoyée',
    paid: 'payée',
    cancelled: 'annulée',
  }
  return JSON.stringify({
    success: true,
    invoice: {
      id: r.data.id,
      number: r.data.number,
      old_status: r.data.oldStatus,
      new_status: status,
      message: `Facture ${r.data.number} marquée comme ${statusLabels[status]}.`,
    },
  })
}

// Fonction pour supprimer une facture
async function deleteInvoiceTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  invoiceNumber: string
): Promise<string> {
  const ctx = { userId: '', companyId }
  const inv = await svc.invoices.findByNumber(supabase, ctx, invoiceNumber)
  if (!inv.ok) {
    return JSON.stringify({ success: false, error: `Facture "${invoiceNumber}" non trouvée.` })
  }
  const r = await svc.invoices.remove(supabase, ctx, inv.data.id)
  if (!r.ok) return JSON.stringify({ success: false, error: r.error })
  return JSON.stringify({ success: true, message: `Facture ${r.data.number} supprimée.` })
}

// Fonction pour mettre à jour le statut d'un devis
async function updateQuoteStatusTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  companyId: string,
  quoteNumber: string,
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
): Promise<string> {
  const ctx = { userId, companyId }
  const q = await svc.quotes.findByNumber(supabase, ctx, quoteNumber)
  if (!q.ok) {
    return JSON.stringify({ success: false, error: `Devis "${quoteNumber}" non trouvé.` })
  }
  const r = await svc.quotes.setStatus(supabase, ctx, q.data.id, status)
  if (!r.ok) return JSON.stringify({ success: false, error: r.error })
  const statusLabels: Record<string, string> = {
    draft: 'brouillon',
    sent: 'envoyé',
    accepted: 'accepté',
    rejected: 'refusé',
  }
  return JSON.stringify({
    success: true,
    quote: {
      id: q.data.id,
      number: r.data.quote_number,
      old_status: r.data.oldStatus,
      new_status: status,
      message: `Devis ${r.data.quote_number} marqué comme ${statusLabels[status]}.`,
    },
  })
}

// Fonction pour supprimer un devis
async function deleteQuoteTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  companyId: string,
  quoteNumber: string
): Promise<string> {
  const ctx = { userId, companyId }
  const q = await svc.quotes.findByNumber(supabase, ctx, quoteNumber)
  if (!q.ok) {
    return JSON.stringify({ success: false, error: `Devis "${quoteNumber}" non trouvé.` })
  }
  const r = await svc.quotes.remove(supabase, ctx, q.data.id)
  if (!r.ok) return JSON.stringify({ success: false, error: r.error })
  return JSON.stringify({ success: true, message: `Devis ${r.data.quote_number} supprimé.` })
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
  const ctx = { userId, companyId }
  const q = await svc.quotes.findByNumber(supabase, ctx, data.quote_number)
  if (!q.ok) {
    return JSON.stringify({ success: false, error: `Devis "${data.quote_number}" non trouvé.` })
  }
  const r = await svc.quotes.update(supabase, ctx, q.data.id, {
    items: data.items,
    notes: data.notes,
    terms: data.terms,
    validity_date: data.validity_date,
  })
  if (!r.ok) return JSON.stringify({ success: false, error: r.error })
  return JSON.stringify({
    success: true,
    quote: {
      id: q.data.id,
      number: r.data.quote_number,
      total: r.data.total !== undefined ? r.data.total.toFixed(2) : undefined,
      message: `Devis ${r.data.quote_number} mis à jour avec succès.`,
    },
  })
}

// Fonction pour convertir un devis en facture
async function convertQuoteToInvoiceTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  companyId: string,
  quoteNumber: string
): Promise<string> {
  const ctx = { userId, companyId }
  const q = await svc.quotes.findByNumber(supabase, ctx, quoteNumber)
  if (!q.ok) {
    return JSON.stringify({ success: false, error: `Devis "${quoteNumber}" non trouvé.` })
  }
  const r = await svc.quotes.convert(supabase, ctx, q.data.id)
  if (!r.ok) return JSON.stringify({ success: false, error: r.error })
  return JSON.stringify({
    success: true,
    invoice: {
      id: r.data.invoiceId,
      number: r.data.invoiceNumber,
      from_quote: r.data.quoteNumber,
      total: r.data.total.toFixed(2),
    },
  })
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

    if (!(await rateLimit('chat', user.id, { max: 20, windowSeconds: 60 }))) {
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

    const apiKey = decryptSecretOrNull(settings?.claude_api_key) || process.env.ANTHROPIC_API_KEY

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
    const { messages, attachments } = body as {
      messages: Array<{ role: string; content: string }>
      attachments?: IncomingAttachment[]
    }

    const anthropic = new Anthropic({ apiKey })

    // Historique de la conversation. Les pièces jointes (PDF/images) sont rattachées
    // au DERNIER message utilisateur (le tour courant) en contenu multimodal ; elles ne
    // sont pas conservées dans l'historique (le frontend n'envoie que des placeholders).
    const conversationMessages: Anthropic.MessageParam[] = messages.map(
      (m): Anthropic.MessageParam => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })
    )

    if (attachments && attachments.length > 0 && conversationMessages.length > 0) {
      const blocks = await buildAttachmentBlocks(attachments)
      const last = conversationMessages[conversationMessages.length - 1]
      if (blocks.length > 0 && last.role === 'user') {
        const text = typeof last.content === 'string' ? last.content : ''
        last.content = [...(text ? [{ type: 'text' as const, text }] : []), ...blocks]
      }
    }

    // Première requête avec les outils
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT + clientsContext,
      tools,
      messages: conversationMessages,
    })

    // Stocker les actions exécutées pour le frontend
    const executedActions: Array<{
      type: string
      success: boolean
      data?: Record<string, unknown>
      error?: string
    }> = []

    // Suggestions de navigation (boutons cliquables côté frontend, jamais automatiques).
    const navigations: Array<{ label: string; path: string }> = []

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
            result = await updateQuoteStatusTool(supabase, user.id, company.id, input.quote_number, input.status)
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
            result = await deleteQuoteTool(supabase, user.id, company.id, input.quote_number)
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
          case 'get_invoice_stats': {
            const r = await svc.invoices.stats(supabase, { userId: user.id, companyId: company.id })
            result = JSON.stringify(r.ok ? r.data : { error: r.error })
            break
          }
          case 'list_invoices': {
            const input = toolUse.input as {
              status?: InvoiceStatus
              client_name?: string
              limit?: number
            }
            const r = await svc.invoices.list(
              supabase,
              { userId: user.id, companyId: company.id },
              { status: input.status, clientName: input.client_name, limit: input.limit }
            )
            result = JSON.stringify(r.ok ? r.data : { error: r.error })
            break
          }
          case 'get_invoice': {
            const input = toolUse.input as { invoice_number: string }
            const ctx = { userId: user.id, companyId: company.id }
            const found = await svc.invoices.findByNumber(supabase, ctx, input.invoice_number)
            if (!found.ok) {
              result = JSON.stringify({ error: found.error })
              break
            }
            const r = await svc.invoices.getById(supabase, ctx, found.data.id)
            result = JSON.stringify(r.ok ? r.data : { error: r.error })
            break
          }
          case 'list_quotes': {
            const input = toolUse.input as { status?: QuoteStatus; limit?: number }
            const r = await svc.quotes.list(
              supabase,
              { userId: user.id, companyId: company.id },
              { status: input.status, limit: input.limit }
            )
            result = JSON.stringify(r.ok ? r.data : { error: r.error })
            break
          }
          case 'get_quote': {
            const input = toolUse.input as { quote_number: string }
            const ctx = { userId: user.id, companyId: company.id }
            const found = await svc.quotes.findByNumber(supabase, ctx, input.quote_number)
            if (!found.ok) {
              result = JSON.stringify({ error: found.error })
              break
            }
            const r = await svc.quotes.getById(supabase, ctx, found.data.id)
            result = JSON.stringify(r.ok ? r.data : { error: r.error })
            break
          }
          case 'list_clients': {
            const input = toolUse.input as { search?: string; limit?: number }
            const r = await svc.clients.list(
              supabase,
              { userId: user.id, companyId: company.id },
              { search: input.search, limit: input.limit }
            )
            result = JSON.stringify(r.ok ? r.data : { error: r.error })
            break
          }
          case 'get_company': {
            const r = await svc.company.getInfo(supabase, { userId: user.id, companyId: company.id })
            result = JSON.stringify(r.ok ? r.data : { error: r.error })
            break
          }
          case 'get_guide': {
            const input = toolUse.input as { topic: string }
            const guide = svc.getGuide(input.topic)
            result = JSON.stringify(
              guide ? { topic: input.topic, guide } : { error: 'Sujet inconnu' }
            )
            break
          }
          case 'navigate': {
            const input = toolUse.input as { destination: string; id?: string; label: string }
            const path = navPath(input.destination, input.id)
            if (!path) {
              result = JSON.stringify({
                success: false,
                error: 'Destination inconnue ou id manquant.',
              })
              break
            }
            navigations.push({ label: input.label, path })
            result = JSON.stringify({ success: true, suggestion: input.label })
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
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        thinking: { type: 'disabled' },
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
      navigations,
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
