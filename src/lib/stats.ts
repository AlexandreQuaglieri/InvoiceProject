// Statistiques du dashboard = fonctions PURES des factures du store live
// (charte règle 1 : état dérivé, jamais dupliqué). Mêmes sémantiques que les
// anciennes actions getInvoiceStats / getRecentInvoices / getOverdueInvoices /
// getTopClients, mais recalculées à chaque event Realtime sans refetch.
import type { Client, InvoiceStatus, InvoiceWithRelations } from '@/types/database'

export type InvoiceStats = {
  totalInvoices: number
  totalDraft: number
  totalSent: number
  totalPaid: number
  totalOverdue: number
  totalCancelled: number
  totalHt: number
  totalTtc: number
  totalPaidAmount: number
  totalPendingAmount: number
  revenueThisMonth: number
  revenueThisYear: number
}

// Statut effectif : une facture « envoyée » dont l'échéance est dépassée est en
// retard, même si la colonne DB n'a pas encore été normalisée (état dérivé).
export function effectiveStatus(
  invoice: Pick<InvoiceWithRelations, 'status' | 'due_date'>,
  today = new Date().toISOString().split('T')[0]
): InvoiceStatus {
  if (invoice.status === 'sent' && invoice.due_date < today) return 'overdue'
  return invoice.status
}

export function computeInvoiceStats(invoices: InvoiceWithRelations[]): InvoiceStats {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const today = now.toISOString().split('T')[0]

  const stats: InvoiceStats = {
    totalInvoices: invoices.length,
    totalDraft: 0,
    totalSent: 0,
    totalPaid: 0,
    totalOverdue: 0,
    totalCancelled: 0,
    totalHt: 0,
    totalTtc: 0,
    totalPaidAmount: 0,
    totalPendingAmount: 0,
    revenueThisMonth: 0,
    revenueThisYear: 0,
  }

  for (const invoice of invoices) {
    stats.totalHt += invoice.total_ht
    stats.totalTtc += invoice.total_ttc

    switch (effectiveStatus(invoice, today)) {
      case 'draft':
        stats.totalDraft++
        break
      case 'sent':
        stats.totalSent++
        stats.totalPendingAmount += invoice.total_ttc
        break
      case 'paid':
        stats.totalPaid++
        stats.totalPaidAmount += invoice.total_ttc
        if (invoice.paid_at) {
          const paidDate = new Date(invoice.paid_at)
          if (paidDate >= startOfMonth) stats.revenueThisMonth += invoice.total_ttc
          if (paidDate >= startOfYear) stats.revenueThisYear += invoice.total_ttc
        }
        break
      case 'overdue':
        stats.totalOverdue++
        stats.totalPendingAmount += invoice.total_ttc
        break
      case 'cancelled':
        stats.totalCancelled++
        break
    }
  }

  return stats
}

export function recentInvoices(invoices: InvoiceWithRelations[], limit = 5): InvoiceWithRelations[] {
  return [...invoices].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit)
}

export function overdueInvoices(invoices: InvoiceWithRelations[]): InvoiceWithRelations[] {
  const today = new Date().toISOString().split('T')[0]
  return invoices
    .filter((invoice) => effectiveStatus(invoice, today) === 'overdue')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
}

export function topClients(
  invoices: InvoiceWithRelations[],
  limit = 5
): Array<{ client: Client; totalTtc: number; invoiceCount: number }> {
  const clientStats = new Map<string, { client: Client; totalTtc: number; invoiceCount: number }>()

  for (const invoice of invoices) {
    if (invoice.status !== 'paid' || !invoice.client) continue
    const existing = clientStats.get(invoice.client_id)
    if (existing) {
      existing.totalTtc += invoice.total_ttc
      existing.invoiceCount++
    } else {
      clientStats.set(invoice.client_id, {
        client: invoice.client,
        totalTtc: invoice.total_ttc,
        invoiceCount: 1,
      })
    }
  }

  return Array.from(clientStats.values())
    .sort((a, b) => b.totalTtc - a.totalTtc)
    .slice(0, limit)
}
