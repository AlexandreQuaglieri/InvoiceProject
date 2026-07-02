import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import * as svc from '@/lib/services'

// Factory du handler MCP Factur-IA, partagée par les deux montages :
//   - /mcp            (route exacte, streamable HTTP — URL officielle du connecteur, ChatGPT)
//   - /mcp/[transport] (basePath — /mcp/mcp streamable + /mcp/sse legacy, Claude)
// mcp-handler compare STRICTEMENT url.pathname à ses endpoints configurés (et les
// rewrites Next ne changent pas request.url), d'où deux instances avec chacune
// sa config d'endpoints plutôt qu'un rewrite.

// ============ HELPERS ============

type ToolResult = {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

// Réponse de succès
function ok(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

// Réponse d'erreur : isError permet au modèle de distinguer un échec d'un succès.
function fail(text: string): ToolResult {
  return { content: [{ type: 'text', text: `❌ ${text}` }], isError: true }
}

type AdminClient = ReturnType<typeof createAdminClient>

// Résolution de l'entreprise déléguée à la couche services (source de vérité unique),
// en conservant la forme de retour attendue par les outils MCP de lecture.
async function resolveCompanyId(
  supabase: AdminClient,
  userId: string
): Promise<{ companyId: string } | { error: string }> {
  const r = await svc.resolveCompanyId(supabase, userId)
  return r.ok ? { companyId: r.data } : { error: r.error }
}

const STATUS_ICONS: Record<string, string> = {
  draft: '📝',
  sent: '📤',
  paid: '✅',
  overdue: '⚠️',
  cancelled: '❌',
}

const QUOTE_STATUS_ICONS: Record<string, string> = {
  draft: '📝',
  sent: '📤',
  accepted: '✅',
  rejected: '❌',
  expired: '⏰',
  converted: '🔄',
}

// ============ AUTHENTIFICATION ============

const verifyToken = async (
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined

  const supabase = createAdminClient()

  // Token OAuth (généré par /oauth/token)
  if (bearerToken.startsWith('mcp_at_')) {
    const crypto = await import('crypto')
    const tokenHash = crypto.createHash('sha256').update(bearerToken).digest('hex')

    const { data: oauthToken, error } = await supabase
      .from('mcp_oauth_tokens')
      .select('user_id, access_token_expires_at, scope')
      .eq('access_token_hash', tokenHash)
      .maybeSingle()

    if (error || !oauthToken) return undefined
    if (new Date(oauthToken.access_token_expires_at) < new Date()) return undefined

    return {
      token: bearerToken,
      scopes: oauthToken.scope?.split(',') || ['mcp'],
      clientId: 'claude',
      extra: { userId: oauthToken.user_id },
    }
  }

  // Token API legacy (mcp_live_xxx)
  if (bearerToken.startsWith('mcp_live_')) {
    const crypto = await import('crypto')
    const tokenHash = crypto.createHash('sha256').update(bearerToken).digest('hex')

    const { data: tokenRecord, error } = await supabase
      .from('mcp_api_tokens')
      .select('user_id, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (error || !tokenRecord) return undefined
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return undefined
    }

    await supabase
      .from('mcp_api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)

    return {
      token: bearerToken,
      scopes: ['mcp'],
      clientId: 'legacy',
      extra: { userId: tokenRecord.user_id },
    }
  }

  return undefined
}

// ============ FACTORY ============

type EndpointConfig = {
  basePath?: string
  streamableHttpEndpoint?: string
  disableSse?: boolean
}

export function createFacturIaMcpHandler(endpoints: EndpointConfig) {
  const handler = createMcpHandler(
    (server) => {
      // ============ CLIENTS ============

      server.tool(
        'list_clients',
        "Liste les clients de l'utilisateur",
        {
          search: z.string().optional().describe('Rechercher par nom ou email'),
          limit: z.number().int().min(1).max(100).optional().describe('Nombre max de résultats'),
        },
        async ({ search, limit }, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const r = await svc.clients.list(
            supabase,
            { userId, companyId: company.companyId },
            { search, limit }
          )
          if (!r.ok) return fail(`Erreur: ${r.error}`)
          if (r.data.length === 0) return ok('Aucun client trouvé.')

          const list = r.data
            .map((c) => `- ${c.name} (${c.email || "pas d'email"}) — ID: ${c.id}`)
            .join('\n')
          return ok(`📋 **${r.data.length} client(s)**\n\n${list}`)
        }
      )

      server.tool(
        'get_client',
        "Récupère le détail d'un client par son ID",
        {
          client_id: z.string().uuid().describe('ID du client'),
        },
        async ({ client_id }, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const cr = await svc.clients.getById(
            supabase,
            { userId, companyId: company.companyId },
            client_id
          )
          if (!cr.ok) return fail(cr.error)
          const c = cr.data

          return ok(
            `👤 **${c.name}** (${c.type === 'individual' ? 'particulier' : 'professionnel'})\n` +
              `ID: ${c.id}\n` +
              `Email: ${c.email || 'Non renseigné'}\n` +
              `Téléphone: ${c.phone || 'Non renseigné'}\n` +
              `Adresse: ${c.address}, ${c.postal_code} ${c.city}, ${c.country || 'France'}\n` +
              `SIRET: ${c.siret || 'Non renseigné'} — TVA: ${c.vat_number || 'Non renseigné'}` +
              (c.notes ? `\nNotes: ${c.notes}` : '')
          )
        }
      )

      server.tool(
        'create_client',
        'Créer un nouveau client',
        {
          name: z.string().min(1).describe('Nom ou raison sociale'),
          type: z
            .enum(['individual', 'professional'])
            .optional()
            .describe('Type de client (défaut: professional)'),
          address: z.string().min(1).describe('Adresse (obligatoire)'),
          postal_code: z.string().min(1).describe('Code postal (obligatoire)'),
          city: z.string().min(1).describe('Ville (obligatoire)'),
          country: z.string().optional().describe('Pays (défaut: France)'),
          email: z.string().email().optional().describe('Email'),
          phone: z.string().optional().describe('Téléphone'),
          siret: z.string().optional().describe('SIRET'),
          vat_number: z.string().optional().describe('Numéro de TVA intracommunautaire'),
          notes: z.string().optional().describe('Notes internes'),
        },
        async (input, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const r = await svc.clients.create(supabase, { userId, companyId: company.companyId }, input)
          if (!r.ok) return fail(`Erreur: ${r.error}`)

          return ok(
            `✅ Client créé !\n\n**${r.data.name}**\nID: ${r.data.id}\nEmail: ${r.data.email || 'Non renseigné'}`
          )
        }
      )

      // ============ FACTURES ============

      server.tool(
        'list_invoices',
        "Liste les factures de l'utilisateur",
        {
          status: z
            .enum(['draft', 'sent', 'paid', 'cancelled', 'overdue'])
            .optional()
            .describe('Filtrer par statut'),
          client_name: z.string().optional().describe('Filtrer par nom de client'),
          limit: z.number().int().min(1).max(50).optional().describe('Nombre max de résultats'),
        },
        async ({ status, client_name, limit }, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const r = await svc.invoices.list(
            supabase,
            { userId, companyId: company.companyId },
            { status, clientName: client_name, limit }
          )
          if (!r.ok) return fail(`Erreur: ${r.error}`)
          if (r.data.length === 0) return ok('Aucune facture trouvée.')

          const list = r.data
            .map(
              (inv) =>
                `${STATUS_ICONS[inv.status] || ''} ${inv.number} — ${inv.clientName} — ${inv.total_ttc.toFixed(2)}€ — ID: ${inv.id}`
            )
            .join('\n')

          return ok(`📄 **${r.data.length} facture(s)**\n\n${list}`)
        }
      )

      server.tool(
        'get_invoice',
        "Récupère le détail complet d'une facture (lignes incluses)",
        {
          invoice_id: z.string().uuid().describe('ID de la facture'),
        },
        async ({ invoice_id }, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const ir = await svc.invoices.getById(
            supabase,
            { userId, companyId: company.companyId },
            invoice_id
          )
          if (!ir.ok) return fail(ir.error)
          const inv = ir.data

          const items = inv.items
            .map(
              (it) =>
                `  • ${it.description} — ${it.quantity} × ${it.unit_price.toFixed(2)}€ ` +
                `(TVA ${it.vat_rate}%) = ${it.total_ttc.toFixed(2)}€ TTC`
            )
            .join('\n')

          return ok(
            `📄 **Facture ${inv.number}** ${STATUS_ICONS[inv.status] || ''} (${inv.status})\n` +
              `Client: ${inv.clientName}\n` +
              `Émise le: ${inv.issue_date} — Échéance: ${inv.due_date}` +
              (inv.paid_at ? ` — Payée le: ${inv.paid_at.split('T')[0]}` : '') +
              `\n\nLignes:\n${items || '  (aucune)'}\n\n` +
              `Total HT: ${inv.total_ht.toFixed(2)}€\n` +
              `TVA: ${inv.total_vat.toFixed(2)}€\n` +
              `**Total TTC: ${inv.total_ttc.toFixed(2)}€**` +
              (inv.notes ? `\n\nNotes: ${inv.notes}` : '')
          )
        }
      )

      server.tool(
        'create_invoice',
        'Créer une nouvelle facture (statut brouillon)',
        {
          client_id: z.string().uuid().describe('ID du client (voir list_clients)'),
          items: z
            .array(
              z.object({
                description: z.string().min(1).describe('Description de la ligne'),
                quantity: z.number().min(0.001).describe('Quantité'),
                unit_price: z.number().min(0).describe('Prix unitaire HT (peut être 0)'),
                vat_rate: z
                  .number()
                  .min(0)
                  .max(100)
                  .optional()
                  .describe('Taux de TVA en % (défaut: 20 ; valeurs usuelles: 0, 5.5, 10, 20)'),
              })
            )
            .min(1)
            .describe('Lignes de la facture'),
          issue_date: z
            .string()
            .optional()
            .describe("Date d'émission AAAA-MM-JJ (défaut: aujourd'hui)"),
          due_date: z
            .string()
            .optional()
            .describe("Date d'échéance AAAA-MM-JJ (défaut: +30 jours)"),
          payment_terms: z.string().optional().describe('Conditions de paiement'),
          notes: z.string().optional().describe('Notes additionnelles'),
          discount_type: z
            .enum(['percentage', 'amount'])
            .optional()
            .describe('Type de remise globale'),
          discount_value: z.number().min(0).optional().describe('Valeur de la remise'),
        },
        async (input, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const r = await svc.invoices.create(supabase, { userId, companyId: company.companyId }, input)
          if (!r.ok) return fail(r.error)

          return ok(
            `✅ **Facture créée !**\n\n` +
              `📄 Numéro: ${r.data.number}\n` +
              `👤 Client: ${r.data.clientName}\n` +
              `💰 Total TTC: ${r.data.total_ttc.toFixed(2)}€\n` +
              `📋 Statut: Brouillon\n\nID: ${r.data.id}`
          )
        }
      )

      server.tool(
        'update_invoice_status',
        "Change le statut d'une facture (draft, sent, paid, overdue, cancelled)",
        {
          invoice_id: z.string().uuid().describe('ID de la facture'),
          status: z
            .enum(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
            .describe('Nouveau statut'),
        },
        async ({ invoice_id, status }, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const r = await svc.invoices.setStatus(
            supabase,
            { userId, companyId: company.companyId },
            invoice_id,
            status
          )
          if (!r.ok) return fail(r.error)

          return ok(`${STATUS_ICONS[status] || ''} Facture ${r.data.number} → statut « ${status} »`)
        }
      )

      server.tool(
        'delete_invoice',
        "Supprime une facture (uniquement les brouillons)",
        {
          invoice_id: z.string().uuid().describe('ID de la facture'),
        },
        async ({ invoice_id }, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const r = await svc.invoices.remove(supabase, { userId, companyId: company.companyId }, invoice_id)
          if (!r.ok) return fail(r.error)

          return ok(`🗑️ Facture ${r.data.number} supprimée.`)
        }
      )

      server.tool(
        'get_invoice_stats',
        'Statistiques des factures (CA, en attente, par statut)',
        {},
        async (_, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const r = await svc.invoices.stats(supabase, { userId, companyId: company.companyId })
          if (!r.ok) return fail(`Erreur: ${r.error}`)
          const s = r.data
          if (s.total === 0) return ok('Aucune facture pour le moment.')

          return ok(
            `📊 **Statistiques Factures**\n\n` +
              `📋 Total: ${s.total}\n` +
              `📝 Brouillons: ${s.draft}\n` +
              `📤 Envoyées: ${s.sent}\n` +
              `✅ Payées: ${s.paid}\n` +
              `⚠️ En retard: ${s.overdue}\n` +
              `❌ Annulées: ${s.cancelled}\n\n` +
              `💰 CA encaissé (mois): ${s.revenueThisMonth.toFixed(2)}€\n` +
              `💰 CA encaissé (année): ${s.revenueThisYear.toFixed(2)}€\n` +
              `💰 Total encaissé: ${s.totalPaid.toFixed(2)}€\n` +
              `⏳ En attente: ${s.totalPending.toFixed(2)}€`
          )
        }
      )

      // ============ DEVIS ============

      server.tool(
        'list_quotes',
        "Liste les devis de l'utilisateur",
        {
          status: z
            .enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'])
            .optional()
            .describe('Filtrer par statut'),
          limit: z.number().int().min(1).max(50).optional().describe('Nombre max de résultats'),
        },
        async ({ status, limit }, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const r = await svc.quotes.list(
            supabase,
            { userId, companyId: company.companyId },
            { status, limit }
          )
          if (!r.ok) return fail(`Erreur: ${r.error}`)
          if (r.data.length === 0) return ok('Aucun devis trouvé.')

          const list = r.data
            .map(
              (q) =>
                `${QUOTE_STATUS_ICONS[q.status] || ''} ${q.quote_number} — ${q.clientName} — ${q.total.toFixed(2)}€ TTC — ID: ${q.id}`
            )
            .join('\n')

          return ok(`🧾 **${r.data.length} devis**\n\n${list}`)
        }
      )

      server.tool(
        'get_quote',
        "Récupère le détail complet d'un devis (lignes incluses)",
        {
          quote_id: z.string().uuid().describe('ID du devis'),
        },
        async ({ quote_id }, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const qr = await svc.quotes.getById(
            supabase,
            { userId, companyId: company.companyId },
            quote_id
          )
          if (!qr.ok) return fail(qr.error)
          const q = qr.data

          const items = q.items
            .map(
              (it) =>
                `  • ${it.description} — ${it.quantity} × ${it.unit_price.toFixed(2)}€ ` +
                `(TVA ${it.tax_rate}%) = ${it.total.toFixed(2)}€ HT`
            )
            .join('\n')

          return ok(
            `🧾 **Devis ${q.quote_number}** ${QUOTE_STATUS_ICONS[q.status] || ''} (${q.status})\n` +
              `Client: ${q.clientName}\n` +
              `Émis le: ${q.issue_date} — Valide jusqu'au: ${q.validity_date}` +
              (q.converted_invoice_id ? `\nConverti en facture: ${q.converted_invoice_id}` : '') +
              `\n\nLignes:\n${items || '  (aucune)'}\n\n` +
              `Sous-total HT: ${q.subtotal.toFixed(2)}€\n` +
              `TVA: ${q.tax_amount.toFixed(2)}€\n` +
              `**Total TTC: ${q.total.toFixed(2)}€**` +
              (q.notes ? `\n\nNotes: ${q.notes}` : '') +
              (q.terms ? `\nConditions: ${q.terms}` : '')
          )
        }
      )

      server.tool(
        'create_quote',
        'Créer un nouveau devis (statut brouillon)',
        {
          client_id: z.string().uuid().describe('ID du client (voir list_clients)'),
          items: z
            .array(
              z.object({
                description: z.string().min(1).describe('Description de la ligne'),
                quantity: z.number().min(0.001).describe('Quantité'),
                unit_price: z.number().min(0).describe('Prix unitaire HT (peut être 0)'),
                tax_rate: z
                  .number()
                  .min(0)
                  .max(100)
                  .optional()
                  .describe('Taux de TVA en % (défaut: 20)'),
              })
            )
            .min(1)
            .describe('Lignes du devis'),
          issue_date: z
            .string()
            .optional()
            .describe("Date d'émission AAAA-MM-JJ (défaut: aujourd'hui)"),
          validity_date: z
            .string()
            .optional()
            .describe('Date de validité AAAA-MM-JJ (défaut: +30 jours)'),
          notes: z.string().optional().describe('Notes'),
          terms: z.string().optional().describe('Conditions particulières'),
        },
        async (input, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const r = await svc.quotes.create(supabase, { userId, companyId: company.companyId }, input)
          if (!r.ok) return fail(r.error)

          return ok(
            `✅ **Devis créé !**\n\n` +
              `🧾 Numéro: ${r.data.quote_number}\n` +
              `👤 Client: ${r.data.clientName}\n` +
              `💰 Total TTC: ${r.data.total.toFixed(2)}€\n` +
              `📋 Statut: Brouillon\n\nID: ${r.data.id}`
          )
        }
      )

      server.tool(
        'update_quote_status',
        "Change le statut d'un devis (draft, sent, accepted, rejected, expired). Pour convertir en facture, utiliser convert_quote_to_invoice.",
        {
          quote_id: z.string().uuid().describe('ID du devis'),
          status: z
            .enum(['draft', 'sent', 'accepted', 'rejected', 'expired'])
            .describe('Nouveau statut'),
        },
        async ({ quote_id, status }, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const r = await svc.quotes.setStatus(
            supabase,
            { userId, companyId: company.companyId },
            quote_id,
            status
          )
          if (!r.ok) return fail(r.error)

          return ok(`${QUOTE_STATUS_ICONS[status] || ''} Devis ${r.data.quote_number} → statut « ${status} »`)
        }
      )

      server.tool(
        'convert_quote_to_invoice',
        'Convertit un devis en facture (brouillon). Le devis passe au statut « converted ».',
        {
          quote_id: z.string().uuid().describe('ID du devis à convertir'),
        },
        async ({ quote_id }, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const company = await resolveCompanyId(supabase, userId)
          if ('error' in company) return fail(company.error)

          const r = await svc.quotes.convert(supabase, { userId, companyId: company.companyId }, quote_id)
          if (!r.ok) return fail(r.error)

          return ok(
            `🔄 Devis converti !\n\n📄 Facture créée: ${r.data.invoiceNumber} (brouillon)\nID facture: ${r.data.invoiceId}`
          )
        }
      )

      // ============ ENTREPRISE ============

      server.tool(
        'get_company',
        "Informations de l'entreprise de l'utilisateur",
        {},
        async (_, extra): Promise<ToolResult> => {
          const userId = extra.authInfo?.extra?.userId as string
          if (!userId) return fail('Non authentifié')

          const supabase = createAdminClient()
          const cr = await svc.company.getInfo(supabase, { userId, companyId: '' })
          if (!cr.ok) return fail(cr.error)
          const company = cr.data

          return ok(
            `🏢 **${company.name}**\n\n` +
              `📧 Email: ${company.email || 'Non renseigné'}\n` +
              `📞 Téléphone: ${company.phone || 'Non renseigné'}\n` +
              `📍 Adresse: ${company.address || 'Non renseignée'}\n` +
              `🏙️ Ville: ${company.city || ''} ${company.postal_code || ''}\n` +
              `🌍 Pays: ${company.country || 'Non renseigné'}\n` +
              `🔢 SIRET: ${company.siret || 'Non renseigné'}\n` +
              `💳 TVA: ${company.vat_number || 'Non renseigné'}`
          )
        }
      )
    },
    {},
    {
      ...endpoints,
      maxDuration: 60,
      verboseLogs: true,
    }
  )

  return withMcpAuth(handler, verifyToken, {
    required: true,
    resourceMetadataPath: '/.well-known/oauth-protected-resource',
  })
}
