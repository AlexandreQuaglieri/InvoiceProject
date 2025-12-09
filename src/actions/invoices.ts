'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  invoiceSchema,
  type InvoiceFormData,
  calculateInvoiceTotals,
  calculateLineTotal,
  generateInvoiceNumber
} from '@/lib/validations/invoice'
import { getCompany } from './company'
import { getUserSettings, updateUserSettings } from './settings'
import type { Invoice, InvoiceItem, InvoiceWithRelations, InvoiceStatus, Client } from '@/types/database'

export async function getInvoices(filters?: {
  status?: InvoiceStatus
  clientId?: string
  search?: string
}): Promise<InvoiceWithRelations[]> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) return []

  let query = supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId)
  }

  if (filters?.search) {
    query = query.or(`number.ilike.%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching invoices:', error)
    return []
  }

  return (data || []) as InvoiceWithRelations[]
}

export async function getInvoice(id: string): Promise<InvoiceWithRelations | null> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) return null

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('id', id)
    .eq('company_id', company.id)
    .single()

  if (error) {
    console.error('Error fetching invoice:', error)
    return null
  }

  return data as InvoiceWithRelations
}

export async function createInvoiceAction(
  formData: InvoiceFormData
): Promise<{ success: boolean; error?: string; data?: Invoice }> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) {
    return { success: false, error: 'Aucune entreprise configurée' }
  }

  const validation = invoiceSchema.safeParse(formData)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message }
  }

  const { items, ...invoiceData } = validation.data

  // Calculer les totaux
  const totals = calculateInvoiceTotals(
    items,
    invoiceData.discount_type,
    invoiceData.discount_value
  )

  // Récupérer et incrémenter le numéro de facture
  const settings = await getUserSettings()
  const invoiceNumber = generateInvoiceNumber(
    settings?.invoice_prefix || 'FAC',
    settings?.invoice_next_number || 1
  )

  // Créer la facture
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id: company.id,
      client_id: invoiceData.client_id,
      number: invoiceNumber,
      status: 'draft',
      issue_date: invoiceData.issue_date,
      due_date: invoiceData.due_date,
      payment_terms: invoiceData.payment_terms || null,
      notes: invoiceData.notes || null,
      discount_type: invoiceData.discount_type || null,
      discount_value: invoiceData.discount_value || 0,
      total_ht: totals.totalHt,
      total_vat: totals.totalVat,
      total_ttc: totals.totalTtc,
    })
    .select()
    .single()

  if (invoiceError) {
    console.error('Error creating invoice:', invoiceError)
    return { success: false, error: 'Erreur lors de la création de la facture' }
  }

  // Créer les lignes de facture
  const invoiceItems = items.map((item, index) => {
    const lineTotal = calculateLineTotal(item.quantity, item.unit_price, item.vat_rate)
    return {
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      total_ht: lineTotal.totalHt,
      total_vat: lineTotal.totalVat,
      total_ttc: lineTotal.totalTtc,
      position: index,
    }
  })

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(invoiceItems)

  if (itemsError) {
    console.error('Error creating invoice items:', itemsError)
    // Supprimer la facture si les lignes échouent
    await supabase.from('invoices').delete().eq('id', invoice.id)
    return { success: false, error: 'Erreur lors de la création des lignes de facture' }
  }

  // Incrémenter le numéro de facture
  await updateUserSettings({
    invoice_next_number: (settings?.invoice_next_number || 1) + 1,
  })

  revalidatePath('/invoices')
  return { success: true, data: invoice }
}

export async function updateInvoiceAction(
  id: string,
  formData: InvoiceFormData
): Promise<{ success: boolean; error?: string; data?: Invoice }> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) {
    return { success: false, error: 'Aucune entreprise configurée' }
  }

  // Vérifier que la facture existe et appartient à cette entreprise
  const existingInvoice = await getInvoice(id)
  if (!existingInvoice) {
    return { success: false, error: 'Facture non trouvée' }
  }

  // On ne peut pas modifier une facture payée ou annulée
  if (existingInvoice.status === 'paid' || existingInvoice.status === 'cancelled') {
    return { success: false, error: 'Cette facture ne peut plus être modifiée' }
  }

  const validation = invoiceSchema.safeParse(formData)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message }
  }

  const { items, ...invoiceData } = validation.data

  // Calculer les totaux
  const totals = calculateInvoiceTotals(
    items,
    invoiceData.discount_type,
    invoiceData.discount_value
  )

  // Mettre à jour la facture
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .update({
      client_id: invoiceData.client_id,
      issue_date: invoiceData.issue_date,
      due_date: invoiceData.due_date,
      payment_terms: invoiceData.payment_terms || null,
      notes: invoiceData.notes || null,
      discount_type: invoiceData.discount_type || null,
      discount_value: invoiceData.discount_value || 0,
      total_ht: totals.totalHt,
      total_vat: totals.totalVat,
      total_ttc: totals.totalTtc,
    })
    .eq('id', id)
    .eq('company_id', company.id)
    .select()
    .single()

  if (invoiceError) {
    console.error('Error updating invoice:', invoiceError)
    return { success: false, error: 'Erreur lors de la mise à jour de la facture' }
  }

  // Supprimer les anciennes lignes
  await supabase.from('invoice_items').delete().eq('invoice_id', id)

  // Créer les nouvelles lignes
  const invoiceItems = items.map((item, index) => {
    const lineTotal = calculateLineTotal(item.quantity, item.unit_price, item.vat_rate)
    return {
      invoice_id: id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      total_ht: lineTotal.totalHt,
      total_vat: lineTotal.totalVat,
      total_ttc: lineTotal.totalTtc,
      position: index,
    }
  })

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(invoiceItems)

  if (itemsError) {
    console.error('Error creating invoice items:', itemsError)
    return { success: false, error: 'Erreur lors de la mise à jour des lignes de facture' }
  }

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${id}`)
  return { success: true, data: invoice }
}

export async function updateInvoiceStatusAction(
  id: string,
  status: InvoiceStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) {
    return { success: false, error: 'Aucune entreprise configurée' }
  }

  const updateData: { status: InvoiceStatus; paid_at?: string | null } = { status }

  // Si le statut est "paid", enregistrer la date de paiement
  if (status === 'paid') {
    updateData.paid_at = new Date().toISOString()
  } else {
    updateData.paid_at = null
  }

  const { error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', id)
    .eq('company_id', company.id)

  if (error) {
    console.error('Error updating invoice status:', error)
    return { success: false, error: 'Erreur lors de la mise à jour du statut' }
  }

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${id}`)
  return { success: true }
}

export async function deleteInvoiceAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) {
    return { success: false, error: 'Aucune entreprise configurée' }
  }

  // Vérifier que la facture existe et peut être supprimée
  const existingInvoice = await getInvoice(id)
  if (!existingInvoice) {
    return { success: false, error: 'Facture non trouvée' }
  }

  // On ne peut pas supprimer une facture envoyée, payée ou annulée
  if (existingInvoice.status !== 'draft') {
    return { success: false, error: 'Seuls les brouillons peuvent être supprimés' }
  }

  // Supprimer les lignes d'abord (contrainte FK)
  await supabase.from('invoice_items').delete().eq('invoice_id', id)

  // Supprimer la facture
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('company_id', company.id)

  if (error) {
    console.error('Error deleting invoice:', error)
    return { success: false, error: 'Erreur lors de la suppression de la facture' }
  }

  revalidatePath('/invoices')
  return { success: true }
}

export async function duplicateInvoiceAction(
  id: string
): Promise<{ success: boolean; error?: string; data?: Invoice }> {
  const existingInvoice = await getInvoice(id)
  if (!existingInvoice) {
    return { success: false, error: 'Facture non trouvée' }
  }

  // Créer une nouvelle facture avec les mêmes données
  const formData: InvoiceFormData = {
    client_id: existingInvoice.client_id,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    payment_terms: existingInvoice.payment_terms || undefined,
    notes: existingInvoice.notes || undefined,
    discount_type: existingInvoice.discount_type as 'percentage' | 'amount' | undefined,
    discount_value: existingInvoice.discount_value || undefined,
    items: existingInvoice.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
    })),
  }

  return createInvoiceAction(formData)
}

// Statistiques pour le dashboard
export async function getInvoiceStats(): Promise<{
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
}> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) {
    return {
      totalInvoices: 0,
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
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('status, total_ht, total_ttc, paid_at')
    .eq('company_id', company.id)

  if (!invoices) {
    return {
      totalInvoices: 0,
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
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const stats = {
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

    switch (invoice.status) {
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
        // Calculer le CA mensuel et annuel
        if (invoice.paid_at) {
          const paidDate = new Date(invoice.paid_at)
          if (paidDate >= startOfMonth) {
            stats.revenueThisMonth += invoice.total_ttc
          }
          if (paidDate >= startOfYear) {
            stats.revenueThisYear += invoice.total_ttc
          }
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

// Récupérer les factures récentes
export async function getRecentInvoices(
  limit: number = 5
): Promise<InvoiceWithRelations[]> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) return []

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent invoices:', error)
    return []
  }

  return (data || []) as InvoiceWithRelations[]
}

// Récupérer les factures en retard
export async function getOverdueInvoices(): Promise<InvoiceWithRelations[]> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) return []

  const today = new Date().toISOString().split('T')[0]

  // Mettre à jour les factures envoyées avec date échue -> overdue
  await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('company_id', company.id)
    .eq('status', 'sent')
    .lt('due_date', today)

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('company_id', company.id)
    .eq('status', 'overdue')
    .order('due_date', { ascending: true })

  if (error) {
    console.error('Error fetching overdue invoices:', error)
    return []
  }

  return (data || []) as InvoiceWithRelations[]
}

// Top clients par chiffre d'affaires
export async function getTopClients(
  limit: number = 5
): Promise<Array<{ client: Client; totalTtc: number; invoiceCount: number }>> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) return []

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      client_id,
      total_ttc,
      client:clients(*)
    `)
    .eq('company_id', company.id)
    .eq('status', 'paid')

  if (error || !invoices) {
    console.error('Error fetching top clients:', error)
    return []
  }

  // Agréger par client
  const clientStats = new Map<string, { client: Client; totalTtc: number; invoiceCount: number }>()

  for (const invoice of invoices) {
    if (!invoice.client) continue

    const clientData = invoice.client as unknown as Client
    const existing = clientStats.get(invoice.client_id)
    if (existing) {
      existing.totalTtc += invoice.total_ttc
      existing.invoiceCount++
    } else {
      clientStats.set(invoice.client_id, {
        client: clientData,
        totalTtc: invoice.total_ttc,
        invoiceCount: 1,
      })
    }
  }

  // Trier par CA et limiter
  return Array.from(clientStats.values())
    .sort((a, b) => b.totalTtc - a.totalTtc)
    .slice(0, limit)
}
