import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

// Créer le handler MCP avec tous les outils
const handler = createMcpHandler(
  (server) => {
    // ============ OUTILS CLIENTS ============

    server.tool(
      'list_clients',
      'Liste tous les clients de l\'utilisateur',
      {
        search: z.string().optional().describe('Rechercher par nom ou email'),
        limit: z.number().int().min(1).max(100).optional().describe('Nombre max de résultats'),
      },
      async ({ search, limit }, extra) => {
        const userId = extra.authInfo?.extra?.userId as string
        console.log('[MCP list_clients] userId:', userId)
        if (!userId) {
          return { content: [{ type: 'text', text: 'Erreur: Non authentifié' }] }
        }

        const supabase = createAdminClient()
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', userId)
          .single()

        console.log('[MCP list_clients] company:', company, 'error:', companyError?.message)

        if (!company) {
          return { content: [{ type: 'text', text: `Erreur: Entreprise non trouvée pour user_id=${userId}. Vérifiez que votre entreprise est bien configurée dans l'app.` }] }
        }

        let query = supabase
          .from('clients')
          .select('*')
          .eq('company_id', company.id)
          .order('name')

        if (search) {
          query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
        }
        if (limit) {
          query = query.limit(limit)
        }

        const { data, error } = await query

        if (error) {
          return { content: [{ type: 'text', text: `Erreur: ${error.message}` }] }
        }

        const clientList = data?.map(c => `- ${c.name} (${c.email || 'pas d\'email'})`).join('\n') || 'Aucun client'
        return {
          content: [{
            type: 'text',
            text: `📋 **${data?.length || 0} client(s) trouvé(s)**\n\n${clientList}`
          }]
        }
      }
    )

    server.tool(
      'create_client',
      'Créer un nouveau client',
      {
        name: z.string().describe('Nom du client'),
        email: z.string().email().optional().describe('Email du client'),
        phone: z.string().optional().describe('Téléphone'),
        address: z.string().optional().describe('Adresse'),
        city: z.string().optional().describe('Ville'),
        postal_code: z.string().optional().describe('Code postal'),
        country: z.string().optional().describe('Pays'),
        vat_number: z.string().optional().describe('Numéro de TVA'),
      },
      async (input, extra) => {
        const userId = extra.authInfo?.extra?.userId as string
        if (!userId) {
          return { content: [{ type: 'text', text: 'Erreur: Non authentifié' }] }
        }

        const supabase = createAdminClient()
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (!company) {
          return { content: [{ type: 'text', text: 'Erreur: Entreprise non trouvée' }] }
        }

        const { data, error } = await supabase
          .from('clients')
          .insert({ ...input, company_id: company.id })
          .select()
          .single()

        if (error) {
          return { content: [{ type: 'text', text: `Erreur: ${error.message}` }] }
        }

        return {
          content: [{
            type: 'text',
            text: `✅ Client créé avec succès!\n\n**${data.name}**\nID: ${data.id}\nEmail: ${data.email || 'Non renseigné'}`
          }]
        }
      }
    )

    // ============ OUTILS FACTURES ============

    server.tool(
      'list_invoices',
      'Liste les factures de l\'utilisateur',
      {
        status: z.enum(['draft', 'sent', 'paid', 'cancelled', 'overdue']).optional().describe('Filtrer par statut'),
        client_name: z.string().optional().describe('Filtrer par nom de client'),
        limit: z.number().int().min(1).max(50).optional().describe('Nombre max de résultats'),
      },
      async ({ status, client_name, limit }, extra) => {
        const userId = extra.authInfo?.extra?.userId as string
        if (!userId) {
          return { content: [{ type: 'text', text: 'Erreur: Non authentifié' }] }
        }

        const supabase = createAdminClient()
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (!company) {
          return { content: [{ type: 'text', text: 'Erreur: Entreprise non trouvée' }] }
        }

        let query = supabase
          .from('invoices')
          .select('*, clients(name)')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false })

        if (status) {
          query = query.eq('status', status)
        }
        if (limit) {
          query = query.limit(limit)
        }

        const { data, error } = await query

        if (error) {
          return { content: [{ type: 'text', text: `Erreur: ${error.message}` }] }
        }

        let invoices = data || []
        if (client_name) {
          invoices = invoices.filter(inv =>
            (inv.clients as { name: string })?.name?.toLowerCase().includes(client_name.toLowerCase())
          )
        }

        const formatStatus = (s: string) => {
          const icons: Record<string, string> = {
            draft: '📝',
            sent: '📤',
            paid: '✅',
            cancelled: '❌',
            overdue: '⚠️'
          }
          return icons[s] || s
        }

        const invoiceList = invoices.map(inv =>
          `${formatStatus(inv.status)} ${inv.invoice_number} - ${(inv.clients as { name: string })?.name || 'N/A'} - ${inv.total_ttc}€`
        ).join('\n') || 'Aucune facture'

        return {
          content: [{
            type: 'text',
            text: `📄 **${invoices.length} facture(s)**\n\n${invoiceList}`
          }]
        }
      }
    )

    server.tool(
      'get_invoice_stats',
      'Obtenir les statistiques des factures',
      {},
      async (_, extra) => {
        const userId = extra.authInfo?.extra?.userId as string
        if (!userId) {
          return { content: [{ type: 'text', text: 'Erreur: Non authentifié' }] }
        }

        const supabase = createAdminClient()
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (!company) {
          return { content: [{ type: 'text', text: 'Erreur: Entreprise non trouvée' }] }
        }

        const { data: invoices } = await supabase
          .from('invoices')
          .select('status, total_ttc')
          .eq('company_id', company.id)

        if (!invoices) {
          return { content: [{ type: 'text', text: 'Aucune donnée' }] }
        }

        const stats = {
          total: invoices.length,
          draft: invoices.filter(i => i.status === 'draft').length,
          sent: invoices.filter(i => i.status === 'sent').length,
          paid: invoices.filter(i => i.status === 'paid').length,
          overdue: invoices.filter(i => i.status === 'overdue').length,
          totalPaid: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total_ttc || 0), 0),
          totalPending: invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((sum, i) => sum + (i.total_ttc || 0), 0),
        }

        return {
          content: [{
            type: 'text',
            text: `📊 **Statistiques Factures**

📋 Total: ${stats.total}
📝 Brouillons: ${stats.draft}
📤 Envoyées: ${stats.sent}
✅ Payées: ${stats.paid}
⚠️ En retard: ${stats.overdue}

💰 Total encaissé: ${stats.totalPaid.toFixed(2)}€
⏳ En attente: ${stats.totalPending.toFixed(2)}€`
          }]
        }
      }
    )

    server.tool(
      'create_invoice',
      'Créer une nouvelle facture',
      {
        client_id: z.string().uuid().describe('ID du client'),
        items: z.array(z.object({
          description: z.string().describe('Description de la ligne'),
          quantity: z.number().positive().describe('Quantité'),
          unit_price: z.number().positive().describe('Prix unitaire HT'),
          vat_rate: z.number().min(0).max(100).optional().describe('Taux de TVA (défaut: 20)'),
        })).min(1).describe('Lignes de la facture'),
        notes: z.string().optional().describe('Notes additionnelles'),
      },
      async ({ client_id, items, notes }, extra) => {
        const userId = extra.authInfo?.extra?.userId as string
        if (!userId) {
          return { content: [{ type: 'text', text: 'Erreur: Non authentifié' }] }
        }

        const supabase = createAdminClient()
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (!company) {
          return { content: [{ type: 'text', text: 'Erreur: Entreprise non trouvée' }] }
        }

        // Vérifier que le client appartient à l'utilisateur
        const { data: client } = await supabase
          .from('clients')
          .select('id, name')
          .eq('id', client_id)
          .eq('company_id', company.id)
          .single()

        if (!client) {
          return { content: [{ type: 'text', text: 'Erreur: Client non trouvé' }] }
        }

        // Calculer les totaux
        const invoiceItems = items.map(item => {
          const vatRate = item.vat_rate ?? 20
          const totalHt = item.quantity * item.unit_price
          const totalVat = totalHt * (vatRate / 100)
          return {
            ...item,
            vat_rate: vatRate,
            total_ht: totalHt,
            total_vat: totalVat,
            total_ttc: totalHt + totalVat,
          }
        })

        const totalHt = invoiceItems.reduce((sum, i) => sum + i.total_ht, 0)
        const totalVat = invoiceItems.reduce((sum, i) => sum + i.total_vat, 0)
        const totalTtc = invoiceItems.reduce((sum, i) => sum + i.total_ttc, 0)

        // Générer le numéro de facture
        const now = new Date()
        const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

        const { count } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .like('invoice_number', `${datePrefix}-%`)

        const invoiceNumber = `${datePrefix}-${String((count || 0) + 1).padStart(2, '0')}`

        // Créer la facture
        const { data: invoice, error } = await supabase
          .from('invoices')
          .insert({
            company_id: company.id,
            client_id: client_id,
            invoice_number: invoiceNumber,
            status: 'draft',
            issue_date: now.toISOString().split('T')[0],
            due_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: invoiceItems,
            total_ht: totalHt,
            total_vat: totalVat,
            total_ttc: totalTtc,
            notes: notes,
          })
          .select()
          .single()

        if (error) {
          return { content: [{ type: 'text', text: `Erreur: ${error.message}` }] }
        }

        return {
          content: [{
            type: 'text',
            text: `✅ **Facture créée!**

📄 Numéro: ${invoice.invoice_number}
👤 Client: ${client.name}
💰 Total TTC: ${totalTtc.toFixed(2)}€
📋 Statut: Brouillon

ID: ${invoice.id}`
          }]
        }
      }
    )

    // ============ OUTIL ENTREPRISE ============

    server.tool(
      'get_company',
      'Obtenir les informations de l\'entreprise',
      {},
      async (_, extra) => {
        const userId = extra.authInfo?.extra?.userId as string
        if (!userId) {
          return { content: [{ type: 'text', text: 'Erreur: Non authentifié' }] }
        }

        const supabase = createAdminClient()
        const { data: company, error } = await supabase
          .from('companies')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (error || !company) {
          return { content: [{ type: 'text', text: 'Erreur: Entreprise non trouvée' }] }
        }

        return {
          content: [{
            type: 'text',
            text: `🏢 **${company.name}**

📧 Email: ${company.email || 'Non renseigné'}
📞 Téléphone: ${company.phone || 'Non renseigné'}
📍 Adresse: ${company.address || 'Non renseignée'}
🏙️ Ville: ${company.city || ''} ${company.postal_code || ''}
🌍 Pays: ${company.country || 'Non renseigné'}
🔢 SIRET: ${company.siret || 'Non renseigné'}
💳 TVA: ${company.vat_number || 'Non renseigné'}`
          }]
        }
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

// Fonction de vérification du token OAuth
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
      .single()

    if (error || !oauthToken) {
      console.log('[MCP Auth] OAuth token not found')
      return undefined
    }

    if (new Date(oauthToken.access_token_expires_at) < new Date()) {
      console.log('[MCP Auth] OAuth token expired')
      return undefined
    }

    console.log('[MCP Auth] OAuth token validated for user:', oauthToken.user_id)
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
      .single()

    if (error || !tokenRecord) {
      console.log('[MCP Auth] Legacy token not found')
      return undefined
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      console.log('[MCP Auth] Legacy token expired')
      return undefined
    }

    // Mettre à jour last_used_at
    await supabase
      .from('mcp_api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)

    console.log('[MCP Auth] Legacy token validated for user:', tokenRecord.user_id)
    return {
      token: bearerToken,
      scopes: ['mcp'],
      clientId: 'legacy',
      extra: { userId: tokenRecord.user_id },
    }
  }

  return undefined
}

// Handler avec authentification
const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
