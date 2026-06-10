'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  QuoteItem,
  QuoteWithRelations,
  QuoteStatus,
  InvoiceWithRelations,
} from '@/types/database'
import { walletSync, walletRemove } from '@/lib/wallet-sync'
import { getNextQuoteNumber } from '@/lib/services/core'
import type { SupabaseClient } from '@supabase/supabase-js'

// Résout l'utilisateur authentifié et son entreprise (scoping company_id, charte règle 5).
async function resolveUserCompany(
  supabase: SupabaseClient
): Promise<{ userId: string; companyId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!company) return null
  return { userId: user.id, companyId: company.id }
}

// Refetch un devis avec ses relations (write-through du store live côté client).
async function fetchQuoteWithRelations(
  supabase: SupabaseClient,
  id: string,
  companyId: string
): Promise<QuoteWithRelations | undefined> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, client:clients(*), items:quote_items(*)')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (error) {
    console.error('Error refetching quote with relations:', error)
    return undefined
  }

  return data as QuoteWithRelations
}

// Refetch une facture avec ses relations (conversion devis → facture).
async function fetchInvoiceWithRelations(
  supabase: SupabaseClient,
  id: string,
  companyId: string
): Promise<InvoiceWithRelations | undefined> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, client:clients(*), items:invoice_items(*)')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (error) {
    console.error('Error refetching invoice with relations:', error)
    return undefined
  }

  return data as InvoiceWithRelations
}

export async function getQuotes(): Promise<QuoteWithRelations[]> {
  const supabase = await createClient()

  const ctx = await resolveUserCompany(supabase)
  if (!ctx) return []

  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      client:clients(*),
      items:quote_items(*)
    `)
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching quotes:', error)
    return []
  }

  return data as QuoteWithRelations[]
}

export async function getQuote(id: string): Promise<QuoteWithRelations | null> {
  const supabase = await createClient()

  const ctx = await resolveUserCompany(supabase)
  if (!ctx) return null

  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      client:clients(*),
      items:quote_items(*)
    `)
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .single()

  if (error) {
    console.error('Error fetching quote:', error)
    return null
  }

  return data as QuoteWithRelations
}

interface CreateQuoteData {
  client_id: string
  issue_date: string
  validity_date: string
  notes?: string
  terms?: string
  items: {
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
  }[]
}

export async function createQuote(
  data: CreateQuoteData
): Promise<{ success: boolean; error?: string; quote?: QuoteWithRelations }> {
  const supabase = await createClient()

  const ctx = await resolveUserCompany(supabase)
  if (!ctx) {
    return { success: false, error: 'Non authentifié ou aucune entreprise configurée' }
  }

  // Calculer les totaux
  let subtotal = 0
  let taxAmount = 0
  const itemsWithTotals = data.items.map((item, index) => {
    const itemTotal = item.quantity * item.unit_price
    const itemTax = itemTotal * (item.tax_rate / 100)
    subtotal += itemTotal
    taxAmount += itemTax
    return {
      ...item,
      total: itemTotal,
      position: index,
    }
  })

  const total = subtotal + taxAmount

  // Générer le numéro de devis (numérotation par entreprise, services/core.ts)
  const quoteNumber = await getNextQuoteNumber(supabase, ctx.companyId)

  // Créer le devis
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      user_id: ctx.userId,
      company_id: ctx.companyId,
      client_id: data.client_id,
      quote_number: quoteNumber,
      issue_date: data.issue_date,
      validity_date: data.validity_date,
      status: 'draft',
      subtotal,
      tax_amount: taxAmount,
      total,
      notes: data.notes || null,
      terms: data.terms || null,
    })
    .select()
    .single()

  if (quoteError) {
    console.error('Error creating quote:', quoteError)
    return { success: false, error: 'Erreur lors de la création du devis' }
  }

  // Créer les lignes du devis
  const { error: itemsError } = await supabase
    .from('quote_items')
    .insert(
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

  if (itemsError) {
    console.error('Error creating quote items:', itemsError)
    // Supprimer le devis si les items n'ont pas pu être créés
    await supabase.from('quotes').delete().eq('id', quote.id)
    return { success: false, error: 'Erreur lors de la création des lignes du devis' }
  }

  await walletSync('quotes', quote, ctx.userId)
  revalidatePath('/quotes')

  // Refetch avec relations pour le write-through du store live.
  const fullQuote = await fetchQuoteWithRelations(supabase, quote.id, ctx.companyId)
  return { success: true, quote: fullQuote }
}

export async function updateQuote(
  id: string,
  data: CreateQuoteData
): Promise<{ success: boolean; error?: string; quote?: QuoteWithRelations }> {
  const supabase = await createClient()

  const ctx = await resolveUserCompany(supabase)
  if (!ctx) {
    return { success: false, error: 'Non authentifié ou aucune entreprise configurée' }
  }

  // Vérifier que le devis existe et appartient à l'entreprise
  const { data: existing } = await supabase
    .from('quotes')
    .select('id, status')
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .single()

  if (!existing) {
    return { success: false, error: 'Devis non trouvé' }
  }

  if (existing.status !== 'draft') {
    return { success: false, error: 'Seuls les devis brouillons peuvent être modifiés' }
  }

  // Recalculer les totaux
  let subtotal = 0
  let taxAmount = 0
  const itemsWithTotals = data.items.map((item, index) => {
    const itemTotal = item.quantity * item.unit_price
    const itemTax = itemTotal * (item.tax_rate / 100)
    subtotal += itemTotal
    taxAmount += itemTax
    return { ...item, total: itemTotal, position: index }
  })

  const total = subtotal + taxAmount

  // Mettre à jour le devis
  const { data: updatedQuote, error: quoteError } = await supabase
    .from('quotes')
    .update({
      client_id: data.client_id,
      issue_date: data.issue_date,
      validity_date: data.validity_date,
      notes: data.notes || null,
      terms: data.terms || null,
      subtotal,
      tax_amount: taxAmount,
      total,
    })
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .select()
    .single()

  if (quoteError) {
    console.error('Error updating quote:', quoteError)
    return { success: false, error: 'Erreur lors de la mise à jour du devis' }
  }

  // Supprimer les anciennes lignes et recréer
  await supabase.from('quote_items').delete().eq('quote_id', id)

  const { error: itemsError } = await supabase
    .from('quote_items')
    .insert(
      itemsWithTotals.map((item) => ({
        quote_id: id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        total: item.total,
        position: item.position,
      }))
    )

  if (itemsError) {
    console.error('Error updating quote items:', itemsError)
    return { success: false, error: 'Erreur lors de la mise à jour des lignes' }
  }

  if (updatedQuote) await walletSync('quotes', updatedQuote, ctx.userId)
  revalidatePath('/quotes')
  revalidatePath(`/quotes/${id}`)

  // Refetch avec relations pour le write-through du store live.
  const fullQuote = await fetchQuoteWithRelations(supabase, id, ctx.companyId)
  return { success: true, quote: fullQuote }
}

export async function updateQuoteStatus(
  id: string,
  status: QuoteStatus
): Promise<{ success: boolean; error?: string; quote?: QuoteWithRelations }> {
  const supabase = await createClient()

  const ctx = await resolveUserCompany(supabase)
  if (!ctx) {
    return { success: false, error: 'Non authentifié ou aucune entreprise configurée' }
  }

  const { data: updatedQuote, error } = await supabase
    .from('quotes')
    .update({ status })
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .select()
    .single()

  if (error) {
    console.error('Error updating quote status:', error)
    return { success: false, error: 'Erreur lors de la mise à jour du statut' }
  }

  if (updatedQuote) await walletSync('quotes', updatedQuote, ctx.userId)
  revalidatePath('/quotes')
  revalidatePath(`/quotes/${id}`)

  // Refetch avec relations pour le write-through du store live.
  const fullQuote = await fetchQuoteWithRelations(supabase, id, ctx.companyId)
  return { success: true, quote: fullQuote }
}

export async function deleteQuote(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const ctx = await resolveUserCompany(supabase)
  if (!ctx) {
    return { success: false, error: 'Non authentifié ou aucune entreprise configurée' }
  }

  // Vérifier que le devis n'est pas converti
  const { data: quote } = await supabase
    .from('quotes')
    .select('status')
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .single()

  if (quote?.status === 'converted') {
    return { success: false, error: 'Impossible de supprimer un devis converti en facture' }
  }

  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx.companyId)

  if (error) {
    console.error('Error deleting quote:', error)
    return { success: false, error: 'Erreur lors de la suppression du devis' }
  }

  await walletRemove('quotes', id, ctx.userId)
  revalidatePath('/quotes')
  return { success: true }
}

export async function convertQuoteToInvoice(quoteId: string): Promise<{
  success: boolean
  error?: string
  invoiceId?: string
  invoice?: InvoiceWithRelations
  quote?: QuoteWithRelations
}> {
  const supabase = await createClient()

  const ctx = await resolveUserCompany(supabase)
  if (!ctx) {
    return { success: false, error: 'Non authentifié ou aucune entreprise configurée' }
  }

  // Récupérer le devis avec ses items
  const { data: quote } = await supabase
    .from('quotes')
    .select(`
      *,
      items:quote_items(*)
    `)
    .eq('id', quoteId)
    .eq('company_id', ctx.companyId)
    .single()

  if (!quote) {
    return { success: false, error: 'Devis non trouvé' }
  }

  if (quote.status === 'converted') {
    return { success: false, error: 'Ce devis a déjà été converti en facture' }
  }

  // Récupérer les paramètres utilisateur pour le numéro de facture
  const { data: settings } = await supabase
    .from('user_settings')
    .select('invoice_prefix, invoice_next_number')
    .eq('user_id', ctx.userId)
    .single()

  const nextNumber = settings?.invoice_next_number || 1
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const invoiceNumber = `${year}${month}${day}-${String(nextNumber).padStart(2, '0')}`

  // Créer la facture
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id: quote.company_id,
      client_id: quote.client_id,
      number: invoiceNumber,
      status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: quote.notes,
      total_ht: quote.subtotal,
      total_vat: quote.tax_amount,
      total_ttc: quote.total,
    })
    .select()
    .single()

  if (invoiceError) {
    console.error('Error creating invoice from quote:', invoiceError)
    return { success: false, error: 'Erreur lors de la création de la facture' }
  }

  // Créer les lignes de facture
  const items = quote.items as QuoteItem[]
  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(
      items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.tax_rate,
        total_ht: item.quantity * item.unit_price,
        total_vat: item.quantity * item.unit_price * (item.tax_rate / 100),
        total_ttc: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
        position: item.position,
      }))
    )

  if (itemsError) {
    console.error('Error creating invoice items:', itemsError)
    await supabase.from('invoices').delete().eq('id', invoice.id)
    return { success: false, error: 'Erreur lors de la création des lignes de facture' }
  }

  // Mettre à jour le devis
  await supabase
    .from('quotes')
    .update({
      status: 'converted',
      converted_invoice_id: invoice.id,
    })
    .eq('id', quoteId)

  // Incrémenter le numéro de facture
  await supabase
    .from('user_settings')
    .update({ invoice_next_number: nextNumber + 1 })
    .eq('user_id', ctx.userId)

  await walletSync('invoices', invoice, ctx.userId)
  await walletSync('quotes', { ...quote, status: 'converted', converted_invoice_id: invoice.id }, ctx.userId)
  revalidatePath('/quotes')
  revalidatePath('/invoices')

  // Refetch facture + devis avec relations pour le write-through du store live.
  const [fullInvoice, fullQuote] = await Promise.all([
    fetchInvoiceWithRelations(supabase, invoice.id, ctx.companyId),
    fetchQuoteWithRelations(supabase, quoteId, ctx.companyId),
  ])

  return { success: true, invoiceId: invoice.id, invoice: fullInvoice, quote: fullQuote }
}
