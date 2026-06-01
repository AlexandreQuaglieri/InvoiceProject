import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateInvoiceNumber,
  calculateLineTotal,
} from '@/lib/validations/invoice'

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

// Résout l'entreprise de l'utilisateur (maybeSingle => message clair si absente).
async function resolveCompanyId(
  supabase: AdminClient,
  userId: string
): Promise<{ companyId: string } | { error: string }> {
  const { data: company, error } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return { error: `Erreur base de données: ${error.message}` }
  }
  if (!company) {
    return {
      error:
        "Aucune entreprise configurée pour ce compte. Ouvre l'application et complète la fiche entreprise (menu « Entreprise ») avant d'utiliser cet outil.",
    }
  }
  return { companyId: company.id }
}

// Récupère (ou crée) les paramètres utilisateur pour la numérotation des factures.
async function getOrCreateUserSettings(
  supabase: AdminClient,
  userId: string
): Promise<{ invoice_prefix: string; invoice_next_number: number } | null> {
  const { data } = await supabase
    .from('user_settings')
    .select('invoice_prefix, invoice_next_number')
    .eq('user_id', userId)
    .maybeSingle()

  if (data) return data

  const { data: created, error } = await supabase
    .from('user_settings')
    .insert({ user_id: userId, invoice_prefix: 'FAC', invoice_next_number: 1 })
    .select('invoice_prefix, invoice_next_number')
    .single()

  if (error) return null
  return created
}

// Numéro de devis suivant au format D-YYYY-NNN (cohérent avec l'application).
async function getNextQuoteNumber(supabase: AdminClient, userId: string): Promise<string> {
  const year = new Date().getFullYear()

  const { data } = await supabase
    .from('quotes')
    .select('quote_number')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return `D-${year}-001`

  const last = data[0].quote_number as string
  const match = last.match(/D-\d{4}-(\d+)/) || last.match(/D-(\d+)/)
  if (match) {
    return `D-${year}-${String(parseInt(match[1], 10) + 1).padStart(3, '0')}`
  }
  return `D-${year}-001`
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

// ============ HANDLER MCP ============

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

        let query = supabase
          .from('clients')
          .select('id, name, email, city, type')
          .eq('company_id', company.companyId)
          .order('name')

        if (search) {
          query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
        }
        if (limit) query = query.limit(limit)

        const { data, error } = await query
        if (error) return fail(`Erreur: ${error.message}`)

        if (!data || data.length === 0) return ok('Aucun client trouvé.')

        const list = data
          .map((c) => `- ${c.name} (${c.email || "pas d'email"}) — ID: ${c.id}`)
          .join('\n')
        return ok(`📋 **${data.length} client(s)**\n\n${list}`)
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

        const { data: c, error } = await supabase
          .from('clients')
          .select('*')
          .eq('id', client_id)
          .eq('company_id', company.companyId)
          .maybeSingle()

        if (error) return fail(`Erreur: ${error.message}`)
        if (!c) return fail('Client non trouvé')

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

        const { data, error } = await supabase
          .from('clients')
          .insert({
            company_id: company.companyId,
            type: input.type ?? 'professional',
            name: input.name,
            address: input.address,
            postal_code: input.postal_code,
            city: input.city,
            country: input.country || 'France',
            email: input.email ?? null,
            phone: input.phone ?? null,
            siret: input.siret ?? null,
            vat_number: input.vat_number ?? null,
            notes: input.notes ?? null,
          })
          .select()
          .single()

        if (error) return fail(`Erreur: ${error.message}`)

        return ok(
          `✅ Client créé !\n\n**${data.name}**\nID: ${data.id}\nEmail: ${data.email || 'Non renseigné'}`
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

        let query = supabase
          .from('invoices')
          .select('id, number, status, total_ttc, due_date, client:clients(name)')
          .eq('company_id', company.companyId)
          .order('created_at', { ascending: false })

        if (status) query = query.eq('status', status)
        if (limit) query = query.limit(limit)

        const { data, error } = await query
        if (error) return fail(`Erreur: ${error.message}`)

        let invoices = data || []
        if (client_name) {
          const needle = client_name.toLowerCase()
          invoices = invoices.filter((inv) =>
            (inv.client as { name?: string } | null)?.name?.toLowerCase().includes(needle)
          )
        }

        if (invoices.length === 0) return ok('Aucune facture trouvée.')

        const list = invoices
          .map((inv) => {
            const clientName = (inv.client as { name?: string } | null)?.name || 'N/A'
            return `${STATUS_ICONS[inv.status] || ''} ${inv.number} — ${clientName} — ${Number(
              inv.total_ttc
            ).toFixed(2)}€ — ID: ${inv.id}`
          })
          .join('\n')

        return ok(`📄 **${invoices.length} facture(s)**\n\n${list}`)
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

        const { data: inv, error } = await supabase
          .from('invoices')
          .select(
            'id, number, status, issue_date, due_date, paid_at, notes, payment_terms, total_ht, total_vat, total_ttc, client:clients(name), items:invoice_items(description, quantity, unit_price, vat_rate, total_ttc, position)'
          )
          .eq('id', invoice_id)
          .eq('company_id', company.companyId)
          .maybeSingle()

        if (error) return fail(`Erreur: ${error.message}`)
        if (!inv) return fail('Facture non trouvée')

        const clientName = (inv.client as { name?: string } | null)?.name || 'N/A'
        const items = ((inv.items as Array<Record<string, unknown>>) || [])
          .sort((a, b) => Number(a.position) - Number(b.position))
          .map(
            (it) =>
              `  • ${it.description} — ${it.quantity} × ${Number(it.unit_price).toFixed(2)}€ ` +
              `(TVA ${it.vat_rate}%) = ${Number(it.total_ttc).toFixed(2)}€ TTC`
          )
          .join('\n')

        return ok(
          `📄 **Facture ${inv.number}** ${STATUS_ICONS[inv.status] || ''} (${inv.status})\n` +
            `Client: ${clientName}\n` +
            `Émise le: ${inv.issue_date} — Échéance: ${inv.due_date}` +
            (inv.paid_at ? ` — Payée le: ${String(inv.paid_at).split('T')[0]}` : '') +
            `\n\nLignes:\n${items || '  (aucune)'}\n\n` +
            `Total HT: ${Number(inv.total_ht).toFixed(2)}€\n` +
            `TVA: ${Number(inv.total_vat).toFixed(2)}€\n` +
            `**Total TTC: ${Number(inv.total_ttc).toFixed(2)}€**` +
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

        // Vérifier que le client appartient à l'entreprise
        const { data: client } = await supabase
          .from('clients')
          .select('id, name')
          .eq('id', input.client_id)
          .eq('company_id', company.companyId)
          .maybeSingle()

        if (!client) return fail('Client non trouvé (vérifie client_id via list_clients)')

        // Numérotation cohérente avec l'application (user_settings)
        const settings = await getOrCreateUserSettings(supabase, userId)
        if (!settings) return fail("Impossible de récupérer les paramètres de numérotation")

        const invoiceNumber = generateInvoiceNumber(
          settings.invoice_prefix || 'FAC',
          settings.invoice_next_number || 1
        )

        const today = new Date().toISOString().split('T')[0]
        const defaultDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]

        // Créer la facture (les totaux seront recalculés par le trigger DB à l'insertion des lignes)
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            company_id: company.companyId,
            client_id: input.client_id,
            number: invoiceNumber,
            status: 'draft',
            issue_date: input.issue_date || today,
            due_date: input.due_date || defaultDue,
            payment_terms: input.payment_terms ?? null,
            notes: input.notes ?? null,
            discount_type: input.discount_type ?? null,
            discount_value: input.discount_value ?? 0,
          })
          .select('id, number')
          .single()

        if (invoiceError) return fail(`Erreur création facture: ${invoiceError.message}`)

        // Créer les lignes (le trigger calcule total_ht/vat/ttc par ligne ET au niveau facture)
        const items = input.items.map((item, index) => {
          const vatRate = item.vat_rate ?? 20
          const line = calculateLineTotal(item.quantity, item.unit_price, vatRate)
          return {
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            vat_rate: vatRate,
            total_ht: line.totalHt,
            total_vat: line.totalVat,
            total_ttc: line.totalTtc,
            position: index,
          }
        })

        const { error: itemsError } = await supabase.from('invoice_items').insert(items)
        if (itemsError) {
          // Rollback : supprimer la facture si les lignes échouent
          await supabase.from('invoices').delete().eq('id', invoice.id)
          return fail(`Erreur création des lignes: ${itemsError.message}`)
        }

        // Incrémenter le compteur de numérotation
        await supabase
          .from('user_settings')
          .update({ invoice_next_number: (settings.invoice_next_number || 1) + 1 })
          .eq('user_id', userId)

        // Relire les totaux finaux (calculés par le trigger)
        const { data: final } = await supabase
          .from('invoices')
          .select('total_ttc')
          .eq('id', invoice.id)
          .maybeSingle()

        return ok(
          `✅ **Facture créée !**\n\n` +
            `📄 Numéro: ${invoice.number}\n` +
            `👤 Client: ${client.name}\n` +
            `💰 Total TTC: ${Number(final?.total_ttc ?? 0).toFixed(2)}€\n` +
            `📋 Statut: Brouillon\n\nID: ${invoice.id}`
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

        const { data: existing } = await supabase
          .from('invoices')
          .select('id, number')
          .eq('id', invoice_id)
          .eq('company_id', company.companyId)
          .maybeSingle()

        if (!existing) return fail('Facture non trouvée')

        const { error } = await supabase
          .from('invoices')
          .update({
            status,
            paid_at: status === 'paid' ? new Date().toISOString() : null,
          })
          .eq('id', invoice_id)
          .eq('company_id', company.companyId)

        if (error) return fail(`Erreur: ${error.message}`)

        return ok(
          `${STATUS_ICONS[status] || ''} Facture ${existing.number} → statut « ${status} »`
        )
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

        const { data: existing } = await supabase
          .from('invoices')
          .select('id, number, status')
          .eq('id', invoice_id)
          .eq('company_id', company.companyId)
          .maybeSingle()

        if (!existing) return fail('Facture non trouvée')
        if (existing.status !== 'draft') {
          return fail('Seuls les brouillons peuvent être supprimés')
        }

        await supabase.from('invoice_items').delete().eq('invoice_id', invoice_id)
        const { error } = await supabase
          .from('invoices')
          .delete()
          .eq('id', invoice_id)
          .eq('company_id', company.companyId)

        if (error) return fail(`Erreur: ${error.message}`)

        return ok(`🗑️ Facture ${existing.number} supprimée.`)
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

        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('status, total_ttc')
          .eq('company_id', company.companyId)

        if (error) return fail(`Erreur: ${error.message}`)
        if (!invoices || invoices.length === 0) return ok('Aucune facture pour le moment.')

        const by = (s: string) => invoices.filter((i) => i.status === s)
        const sum = (rows: typeof invoices) =>
          rows.reduce((acc, i) => acc + Number(i.total_ttc || 0), 0)

        const totalPaid = sum(by('paid'))
        const totalPending = sum(invoices.filter((i) => ['sent', 'overdue'].includes(i.status)))

        return ok(
          `📊 **Statistiques Factures**\n\n` +
            `📋 Total: ${invoices.length}\n` +
            `📝 Brouillons: ${by('draft').length}\n` +
            `📤 Envoyées: ${by('sent').length}\n` +
            `✅ Payées: ${by('paid').length}\n` +
            `⚠️ En retard: ${by('overdue').length}\n` +
            `❌ Annulées: ${by('cancelled').length}\n\n` +
            `💰 Total encaissé: ${totalPaid.toFixed(2)}€\n` +
            `⏳ En attente: ${totalPending.toFixed(2)}€`
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
        let query = supabase
          .from('quotes')
          .select('id, quote_number, status, total, validity_date, client:clients(name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (status) query = query.eq('status', status)
        if (limit) query = query.limit(limit)

        const { data, error } = await query
        if (error) return fail(`Erreur: ${error.message}`)
        if (!data || data.length === 0) return ok('Aucun devis trouvé.')

        const list = data
          .map((q) => {
            const clientName = (q.client as { name?: string } | null)?.name || 'N/A'
            return `${QUOTE_STATUS_ICONS[q.status] || ''} ${q.quote_number} — ${clientName} — ${Number(
              q.total
            ).toFixed(2)}€ TTC — ID: ${q.id}`
          })
          .join('\n')

        return ok(`🧾 **${data.length} devis**\n\n${list}`)
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
        const { data: q, error } = await supabase
          .from('quotes')
          .select(
            'id, quote_number, status, issue_date, validity_date, notes, terms, subtotal, tax_amount, total, converted_invoice_id, client:clients(name), items:quote_items(description, quantity, unit_price, tax_rate, total, position)'
          )
          .eq('id', quote_id)
          .eq('user_id', userId)
          .maybeSingle()

        if (error) return fail(`Erreur: ${error.message}`)
        if (!q) return fail('Devis non trouvé')

        const clientName = (q.client as { name?: string } | null)?.name || 'N/A'
        const items = ((q.items as Array<Record<string, unknown>>) || [])
          .sort((a, b) => Number(a.position) - Number(b.position))
          .map(
            (it) =>
              `  • ${it.description} — ${it.quantity} × ${Number(it.unit_price).toFixed(2)}€ ` +
              `(TVA ${it.tax_rate}%) = ${Number(it.total).toFixed(2)}€ HT`
          )
          .join('\n')

        return ok(
          `🧾 **Devis ${q.quote_number}** ${QUOTE_STATUS_ICONS[q.status] || ''} (${q.status})\n` +
            `Client: ${clientName}\n` +
            `Émis le: ${q.issue_date} — Valide jusqu'au: ${q.validity_date}` +
            (q.converted_invoice_id ? `\nConverti en facture: ${q.converted_invoice_id}` : '') +
            `\n\nLignes:\n${items || '  (aucune)'}\n\n` +
            `Sous-total HT: ${Number(q.subtotal).toFixed(2)}€\n` +
            `TVA: ${Number(q.tax_amount).toFixed(2)}€\n` +
            `**Total TTC: ${Number(q.total).toFixed(2)}€**` +
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

        const { data: client } = await supabase
          .from('clients')
          .select('id, name')
          .eq('id', input.client_id)
          .eq('company_id', company.companyId)
          .maybeSingle()

        if (!client) return fail('Client non trouvé (vérifie client_id via list_clients)')

        // Calcul des totaux (pas de trigger DB sur les devis)
        let subtotal = 0
        let taxAmount = 0
        const itemsWithTotals = input.items.map((item, index) => {
          const taxRate = item.tax_rate ?? 20
          const lineHt = Math.round(item.quantity * item.unit_price * 100) / 100
          const lineTax = Math.round(lineHt * taxRate) / 100
          subtotal += lineHt
          taxAmount += lineTax
          return {
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: taxRate,
            total: lineHt,
            position: index,
          }
        })
        subtotal = Math.round(subtotal * 100) / 100
        taxAmount = Math.round(taxAmount * 100) / 100
        const total = Math.round((subtotal + taxAmount) * 100) / 100

        const today = new Date().toISOString().split('T')[0]
        const defaultValidity = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]

        const quoteNumber = await getNextQuoteNumber(supabase, userId)

        const { data: quote, error: quoteError } = await supabase
          .from('quotes')
          .insert({
            user_id: userId,
            company_id: company.companyId,
            client_id: input.client_id,
            quote_number: quoteNumber,
            issue_date: input.issue_date || today,
            validity_date: input.validity_date || defaultValidity,
            status: 'draft',
            subtotal,
            tax_amount: taxAmount,
            total,
            notes: input.notes ?? null,
            terms: input.terms ?? null,
          })
          .select('id, quote_number')
          .single()

        if (quoteError) return fail(`Erreur création devis: ${quoteError.message}`)

        const { error: itemsError } = await supabase.from('quote_items').insert(
          itemsWithTotals.map((item) => ({ quote_id: quote.id, ...item }))
        )

        if (itemsError) {
          await supabase.from('quotes').delete().eq('id', quote.id)
          return fail(`Erreur création des lignes: ${itemsError.message}`)
        }

        return ok(
          `✅ **Devis créé !**\n\n` +
            `🧾 Numéro: ${quote.quote_number}\n` +
            `👤 Client: ${client.name}\n` +
            `💰 Total TTC: ${total.toFixed(2)}€\n` +
            `📋 Statut: Brouillon\n\nID: ${quote.id}`
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
        const { data: existing } = await supabase
          .from('quotes')
          .select('id, quote_number, status')
          .eq('id', quote_id)
          .eq('user_id', userId)
          .maybeSingle()

        if (!existing) return fail('Devis non trouvé')
        if (existing.status === 'converted') {
          return fail('Un devis converti en facture ne peut plus changer de statut')
        }

        const { error } = await supabase
          .from('quotes')
          .update({ status })
          .eq('id', quote_id)
          .eq('user_id', userId)

        if (error) return fail(`Erreur: ${error.message}`)

        return ok(
          `${QUOTE_STATUS_ICONS[status] || ''} Devis ${existing.quote_number} → statut « ${status} »`
        )
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

        const { data: quote } = await supabase
          .from('quotes')
          .select('*, items:quote_items(*)')
          .eq('id', quote_id)
          .eq('user_id', userId)
          .maybeSingle()

        if (!quote) return fail('Devis non trouvé')
        if (quote.status === 'converted') {
          return fail('Ce devis a déjà été converti en facture')
        }

        const settings = await getOrCreateUserSettings(supabase, userId)
        if (!settings) return fail('Impossible de récupérer les paramètres de numérotation')

        const invoiceNumber = generateInvoiceNumber(
          settings.invoice_prefix || 'FAC',
          settings.invoice_next_number || 1
        )
        const today = new Date().toISOString().split('T')[0]
        const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            company_id: quote.company_id,
            client_id: quote.client_id,
            number: invoiceNumber,
            status: 'draft',
            issue_date: today,
            due_date: due,
            notes: quote.notes,
          })
          .select('id, number')
          .single()

        if (invoiceError) return fail(`Erreur création facture: ${invoiceError.message}`)

        const items = (quote.items as Array<Record<string, unknown>>) || []
        const { error: itemsError } = await supabase.from('invoice_items').insert(
          items.map((item) => {
            const qty = Number(item.quantity)
            const unit = Number(item.unit_price)
            const vatRate = Number(item.tax_rate)
            const line = calculateLineTotal(qty, unit, vatRate)
            return {
              invoice_id: invoice.id,
              description: item.description,
              quantity: qty,
              unit_price: unit,
              vat_rate: vatRate,
              total_ht: line.totalHt,
              total_vat: line.totalVat,
              total_ttc: line.totalTtc,
              position: Number(item.position),
            }
          })
        )

        if (itemsError) {
          await supabase.from('invoices').delete().eq('id', invoice.id)
          return fail(`Erreur création des lignes: ${itemsError.message}`)
        }

        await supabase
          .from('quotes')
          .update({ status: 'converted', converted_invoice_id: invoice.id })
          .eq('id', quote_id)

        await supabase
          .from('user_settings')
          .update({ invoice_next_number: (settings.invoice_next_number || 1) + 1 })
          .eq('user_id', userId)

        return ok(
          `🔄 Devis converti !\n\n📄 Facture créée: ${invoice.number} (brouillon)\nID facture: ${invoice.id}`
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
        const { data: company, error } = await supabase
          .from('companies')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) return fail(`Erreur: ${error.message}`)
        if (!company) {
          return fail(
            "Aucune entreprise configurée. Complète la fiche entreprise dans l'application."
          )
        }

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
    basePath: '/mcp',
    maxDuration: 60,
    verboseLogs: true,
  }
)

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

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
