import { createClient } from '@/lib/supabase/server'
import type { MCPTool } from './index'

export const invoiceTools: MCPTool[] = [
  {
    name: 'list_invoices',
    description: 'Liste toutes vos factures. Filtrez par statut, client, ou recherchez par numéro.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
          description: 'Filtrer par statut: draft (brouillon), sent (envoyée), paid (payée), overdue (en retard), cancelled (annulée)',
        },
        client_id: {
          type: 'string',
          description: 'Filtrer par ID client',
        },
        search: {
          type: 'string',
          description: 'Rechercher par numéro de facture',
        },
      },
    },
  },
  {
    name: 'get_invoice',
    description: 'Récupère une facture complète avec ses lignes et les informations du client.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID de la facture',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_invoice',
    description: 'Crée une nouvelle facture. Spécifiez le client, la date d\'échéance et les lignes de facturation.',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'ID du client à facturer',
        },
        due_date: {
          type: 'string',
          description: 'Date d\'échéance au format YYYY-MM-DD',
        },
        items: {
          type: 'array',
          description: 'Lignes de facturation',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Description de la prestation',
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
                description: 'Taux de TVA en % (défaut: 20, ou 0 si franchise)',
              },
            },
            required: ['description', 'quantity', 'unit_price'],
          },
        },
        notes: {
          type: 'string',
          description: 'Notes sur la facture',
        },
        payment_terms: {
          type: 'string',
          description: 'Conditions de paiement',
        },
      },
      required: ['client_id', 'due_date', 'items'],
    },
  },
  {
    name: 'update_invoice_status',
    description: 'Change le statut d\'une facture (ex: marquer comme envoyée ou payée).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID de la facture',
        },
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
          description: 'Nouveau statut',
        },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'delete_invoice',
    description: 'Supprime une facture. Seuls les brouillons peuvent être supprimés.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID de la facture à supprimer',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_invoice_stats',
    description: 'Récupère les statistiques de facturation: CA mensuel/annuel, factures impayées, etc.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

export async function executeInvoiceTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const supabase = await createClient()

  // Récupérer l'entreprise de l'utilisateur
  const { data: company } = await supabase
    .from('companies')
    .select('id, vat_regime')
    .eq('user_id', userId)
    .single()

  if (!company) {
    throw new Error('Aucune entreprise configurée. Veuillez d\'abord configurer votre entreprise.')
  }

  switch (name) {
    case 'list_invoices': {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, email)
        `)
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })

      if (args.status) {
        query = query.eq('status', args.status as string)
      }

      if (args.client_id) {
        query = query.eq('client_id', args.client_id as string)
      }

      if (args.search) {
        query = query.ilike('number', `%${args.search as string}%`)
      }

      const { data, error } = await query

      if (error) throw new Error(`Erreur lors de la récupération des factures: ${error.message}`)

      // Formater pour une meilleure lisibilité
      const invoices = (data || []).map((inv) => ({
        id: inv.id,
        number: inv.number,
        client: inv.client?.name || 'N/A',
        status: inv.status,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        total_ht: `${inv.total_ht.toFixed(2)} €`,
        total_ttc: `${inv.total_ttc.toFixed(2)} €`,
      }))

      return {
        count: invoices.length,
        invoices,
      }
    }

    case 'get_invoice': {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(*),
          items:invoice_items(*)
        `)
        .eq('id', args.id as string)
        .eq('company_id', company.id)
        .single()

      if (error) throw new Error(`Facture non trouvée`)

      return data
    }

    case 'create_invoice': {
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
      const invoiceNumber = `${year}${month}${day}-${String(nextNumber).padStart(2, '0')}`

      // Calculer les totaux
      const items = args.items as Array<{
        description: string
        quantity: number
        unit_price: number
        vat_rate?: number
      }>

      // Déterminer le taux de TVA par défaut selon le régime
      const defaultVatRate = company.vat_regime === 'franchise' ? 0 : 20

      let totalHt = 0
      let totalVat = 0

      const invoiceItems = items.map((item, index) => {
        const vatRate = item.vat_rate ?? defaultVatRate
        const lineHt = item.quantity * item.unit_price
        const lineVat = lineHt * (vatRate / 100)

        totalHt += lineHt
        totalVat += lineVat

        return {
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: vatRate,
          total_ht: lineHt,
          total_vat: lineVat,
          total_ttc: lineHt + lineVat,
          position: index,
        }
      })

      const totalTtc = totalHt + totalVat

      // Créer la facture
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          company_id: company.id,
          client_id: args.client_id as string,
          number: invoiceNumber,
          status: 'draft',
          issue_date: new Date().toISOString().split('T')[0],
          due_date: args.due_date as string,
          notes: (args.notes as string) || null,
          payment_terms: (args.payment_terms as string) || null,
          total_ht: totalHt,
          total_vat: totalVat,
          total_ttc: totalTtc,
        })
        .select()
        .single()

      if (invoiceError) throw new Error(`Erreur lors de la création de la facture: ${invoiceError.message}`)

      // Créer les lignes
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(
          invoiceItems.map((item) => ({
            invoice_id: invoice.id,
            ...item,
          }))
        )

      if (itemsError) {
        // Rollback
        await supabase.from('invoices').delete().eq('id', invoice.id)
        throw new Error(`Erreur lors de la création des lignes: ${itemsError.message}`)
      }

      // Incrémenter le numéro de facture
      await supabase
        .from('user_settings')
        .update({ invoice_next_number: nextNumber + 1 })
        .eq('user_id', userId)

      return {
        success: true,
        message: `Facture ${invoiceNumber} créée avec succès`,
        invoice: {
          id: invoice.id,
          number: invoiceNumber,
          total_ht: `${totalHt.toFixed(2)} €`,
          total_ttc: `${totalTtc.toFixed(2)} €`,
          status: 'draft',
        },
      }
    }

    case 'update_invoice_status': {
      const newStatus = args.status as string

      const updateData: Record<string, unknown> = { status: newStatus }

      // Si payé, enregistrer la date
      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString()
      } else {
        updateData.paid_at = null
      }

      const { data, error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', args.id as string)
        .eq('company_id', company.id)
        .select('number')
        .single()

      if (error) throw new Error(`Erreur lors de la mise à jour: ${error.message}`)

      const statusLabels: Record<string, string> = {
        draft: 'brouillon',
        sent: 'envoyée',
        paid: 'payée',
        overdue: 'en retard',
        cancelled: 'annulée',
      }

      return {
        success: true,
        message: `Facture ${data.number} marquée comme ${statusLabels[newStatus] || newStatus}`,
      }
    }

    case 'delete_invoice': {
      // Vérifier que c'est un brouillon
      const { data: invoice } = await supabase
        .from('invoices')
        .select('status, number')
        .eq('id', args.id as string)
        .eq('company_id', company.id)
        .single()

      if (!invoice) throw new Error('Facture non trouvée')

      if (invoice.status !== 'draft') {
        throw new Error('Seuls les brouillons peuvent être supprimés. Annulez d\'abord la facture si nécessaire.')
      }

      // Supprimer les lignes puis la facture
      await supabase.from('invoice_items').delete().eq('invoice_id', args.id as string)

      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', args.id as string)
        .eq('company_id', company.id)

      if (error) throw new Error(`Erreur lors de la suppression: ${error.message}`)

      return {
        success: true,
        message: `Facture ${invoice.number} supprimée`,
      }
    }

    case 'get_invoice_stats': {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('status, total_ht, total_ttc, paid_at')
        .eq('company_id', company.id)

      if (!invoices) {
        return {
          totalInvoices: 0,
          totalPaid: 0,
          totalPending: 0,
          revenueThisMonth: '0.00 €',
          revenueThisYear: '0.00 €',
        }
      }

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      let totalPaidAmount = 0
      let totalPendingAmount = 0
      let revenueThisMonth = 0
      let revenueThisYear = 0
      let paidCount = 0
      let pendingCount = 0

      for (const inv of invoices) {
        if (inv.status === 'paid') {
          paidCount++
          totalPaidAmount += inv.total_ttc
          if (inv.paid_at) {
            const paidDate = new Date(inv.paid_at)
            if (paidDate >= startOfMonth) revenueThisMonth += inv.total_ttc
            if (paidDate >= startOfYear) revenueThisYear += inv.total_ttc
          }
        } else if (inv.status === 'sent' || inv.status === 'overdue') {
          pendingCount++
          totalPendingAmount += inv.total_ttc
        }
      }

      return {
        totalInvoices: invoices.length,
        totalPaid: paidCount,
        totalPending: pendingCount,
        totalPaidAmount: `${totalPaidAmount.toFixed(2)} €`,
        totalPendingAmount: `${totalPendingAmount.toFixed(2)} €`,
        revenueThisMonth: `${revenueThisMonth.toFixed(2)} €`,
        revenueThisYear: `${revenueThisYear.toFixed(2)} €`,
      }
    }

    default:
      throw new Error(`Outil facture inconnu: ${name}`)
  }
}
