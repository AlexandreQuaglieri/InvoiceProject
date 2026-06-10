// Service Devis — create/update/statut/suppression/conversion + résolution par numéro.
// Les devis sont scopés par company_id (aligné sur clients/factures, charte règle 5).
import {
  type DbClient,
  type Ctx,
  type ServiceResult,
  ok,
  err,
  getOrCreateUserSettings,
  getNextQuoteNumber,
} from './core'
import { generateInvoiceNumber, calculateLineTotal } from '@/lib/validations/invoice'
import type { QuoteStatus } from '@/types/database'

export type QuoteItemInput = {
  description: string
  quantity: number
  unit_price: number
  tax_rate?: number
}

export type CreateQuoteInput = {
  client_id: string
  items: QuoteItemInput[]
  issue_date?: string
  validity_date?: string
  notes?: string | null
  terms?: string | null
}

export type UpdateQuotePatch = {
  items?: QuoteItemInput[]
  notes?: string | null
  terms?: string | null
  validity_date?: string
}

// Totaux d'un devis (pas de déclencheur DB sur les devis : on calcule ici, arrondi au centime).
function computeTotals(items: QuoteItemInput[]) {
  let subtotal = 0
  let taxAmount = 0
  const withTotals = items.map((item, index) => {
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
  return { subtotal, taxAmount, total, withTotals }
}

export async function create(
  supabase: DbClient,
  ctx: Ctx,
  input: CreateQuoteInput
): Promise<ServiceResult<{ id: string; quote_number: string; total: number; clientName: string }>> {
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', input.client_id)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!client) return err('Client non trouvé (vérifie client_id).')

  const { subtotal, taxAmount, total, withTotals } = computeTotals(input.items)

  const today = new Date().toISOString().split('T')[0]
  const defaultValidity = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
  const quoteNumber = await getNextQuoteNumber(supabase, ctx.companyId)

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      user_id: ctx.userId,
      company_id: ctx.companyId,
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

  if (quoteError) return err(`Erreur création devis: ${quoteError.message}`)

  const { error: itemsError } = await supabase
    .from('quote_items')
    .insert(withTotals.map((item) => ({ quote_id: quote.id, ...item })))

  if (itemsError) {
    await supabase.from('quotes').delete().eq('id', quote.id)
    return err(`Erreur création des lignes: ${itemsError.message}`)
  }

  return ok({ id: quote.id, quote_number: quote.quote_number, total, clientName: client.name })
}

export async function findByNumber(
  supabase: DbClient,
  ctx: Ctx,
  number: string
): Promise<ServiceResult<{ id: string; quote_number: string; status: QuoteStatus }>> {
  const { data } = await supabase
    .from('quotes')
    .select('id, quote_number, status')
    .eq('company_id', ctx.companyId)
    .ilike('quote_number', `%${number}%`)
    .limit(1)

  if (!data || data.length === 0) return err(`Devis "${number}" non trouvé.`)
  return ok(data[0] as { id: string; quote_number: string; status: QuoteStatus })
}

// Modifie un devis brouillon (lignes, notes, conditions, validité).
export async function update(
  supabase: DbClient,
  ctx: Ctx,
  quoteId: string,
  patch: UpdateQuotePatch
): Promise<ServiceResult<{ quote_number: string; total?: number }>> {
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number, status')
    .eq('id', quoteId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!quote) return err('Devis non trouvé.')
  if (quote.status !== 'draft') {
    return err(
      `Le devis ${quote.quote_number} est en statut "${quote.status}" et ne peut plus être modifié. Seuls les brouillons sont modifiables.`
    )
  }

  const updateData: Record<string, unknown> = {}
  let newTotal: number | undefined

  if (patch.items && patch.items.length > 0) {
    const { subtotal, taxAmount, total, withTotals } = computeTotals(patch.items)
    await supabase.from('quote_items').delete().eq('quote_id', quoteId)
    await supabase
      .from('quote_items')
      .insert(withTotals.map((item) => ({ quote_id: quoteId, ...item })))
    updateData.subtotal = subtotal
    updateData.tax_amount = taxAmount
    updateData.total = total
    newTotal = total
  }

  if (patch.notes !== undefined) updateData.notes = patch.notes
  if (patch.terms !== undefined) updateData.terms = patch.terms
  if (patch.validity_date) updateData.validity_date = patch.validity_date

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase.from('quotes').update(updateData).eq('id', quoteId)
    if (error) return err(error.message)
  }

  return ok({ quote_number: quote.quote_number, total: newTotal })
}

export async function setStatus(
  supabase: DbClient,
  ctx: Ctx,
  quoteId: string,
  status: Exclude<QuoteStatus, 'converted'>
): Promise<ServiceResult<{ quote_number: string; oldStatus: QuoteStatus }>> {
  const { data: existing } = await supabase
    .from('quotes')
    .select('id, quote_number, status')
    .eq('id', quoteId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!existing) return err('Devis non trouvé.')
  if (existing.status === 'converted') {
    return err('Un devis converti en facture ne peut plus changer de statut.')
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status })
    .eq('id', quoteId)
    .eq('company_id', ctx.companyId)

  if (error) return err(error.message)
  return ok({ quote_number: existing.quote_number, oldStatus: existing.status })
}

// Supprime un devis (uniquement les brouillons).
export async function remove(
  supabase: DbClient,
  ctx: Ctx,
  quoteId: string
): Promise<ServiceResult<{ quote_number: string }>> {
  const { data: existing } = await supabase
    .from('quotes')
    .select('id, quote_number, status')
    .eq('id', quoteId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!existing) return err('Devis non trouvé.')
  if (existing.status !== 'draft') {
    return err(
      `Impossible de supprimer le devis ${existing.quote_number}: il n'est pas en brouillon (statut: ${existing.status}).`
    )
  }

  await supabase.from('quote_items').delete().eq('quote_id', quoteId)
  const { error } = await supabase.from('quotes').delete().eq('id', quoteId)
  if (error) return err(error.message)
  return ok({ quote_number: existing.quote_number })
}

// Convertit un devis en facture (brouillon). Le devis passe au statut « converted ».
export async function convert(
  supabase: DbClient,
  ctx: Ctx,
  quoteId: string
): Promise<ServiceResult<{ invoiceId: string; invoiceNumber: string; quoteNumber: string; total: number }>> {
  const { data: quote } = await supabase
    .from('quotes')
    .select('*, items:quote_items(*)')
    .eq('id', quoteId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!quote) return err('Devis non trouvé.')
  if (quote.status === 'converted') {
    return err(`Le devis ${quote.quote_number} a déjà été converti en facture.`)
  }

  const settings = await getOrCreateUserSettings(supabase, ctx.userId)
  if (!settings) return err('Impossible de récupérer les paramètres de numérotation.')

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

  if (invoiceError) return err(`Erreur création facture: ${invoiceError.message}`)

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
    return err(`Erreur création des lignes: ${itemsError.message}`)
  }

  await supabase
    .from('quotes')
    .update({ status: 'converted', converted_invoice_id: invoice.id })
    .eq('id', quoteId)

  await supabase
    .from('user_settings')
    .update({ invoice_next_number: (settings.invoice_next_number || 1) + 1 })
    .eq('user_id', ctx.userId)

  return ok({
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    quoteNumber: quote.quote_number,
    total: Number(quote.total),
  })
}

// ---- Lecture ----

export type QuoteListItem = {
  id: string
  quote_number: string
  status: QuoteStatus
  total: number
  validity_date: string
  clientName: string
}

export async function list(
  supabase: DbClient,
  ctx: Ctx,
  opts: { status?: QuoteStatus; limit?: number } = {}
): Promise<ServiceResult<QuoteListItem[]>> {
  let query = supabase
    .from('quotes')
    .select('id, quote_number, status, total, validity_date, client:clients(name)')
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false })

  if (opts.status) query = query.eq('status', opts.status)
  if (opts.limit) query = query.limit(opts.limit)

  const { data, error } = await query
  if (error) return err(error.message)

  return ok(
    ((data ?? []) as Array<Record<string, unknown>>).map((q) => ({
      id: q.id as string,
      quote_number: q.quote_number as string,
      status: q.status as QuoteStatus,
      total: Number(q.total),
      validity_date: q.validity_date as string,
      clientName: (q.client as { name?: string } | null)?.name || 'N/A',
    }))
  )
}

export type QuoteDetail = {
  id: string
  quote_number: string
  status: QuoteStatus
  issue_date: string
  validity_date: string
  notes: string | null
  terms: string | null
  subtotal: number
  tax_amount: number
  total: number
  converted_invoice_id: string | null
  clientName: string
  items: Array<{
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
    total: number
    position: number
  }>
}

export async function getById(
  supabase: DbClient,
  ctx: Ctx,
  quoteId: string
): Promise<ServiceResult<QuoteDetail>> {
  const { data: q, error } = await supabase
    .from('quotes')
    .select(
      'id, quote_number, status, issue_date, validity_date, notes, terms, subtotal, tax_amount, total, converted_invoice_id, client:clients(name), items:quote_items(description, quantity, unit_price, tax_rate, total, position)'
    )
    .eq('id', quoteId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (error) return err(error.message)
  if (!q) return err('Devis non trouvé.')

  const items = (((q as Record<string, unknown>).items as Array<Record<string, unknown>>) || [])
    .map((it) => ({
      description: it.description as string,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      tax_rate: Number(it.tax_rate),
      total: Number(it.total),
      position: Number(it.position),
    }))
    .sort((a, b) => a.position - b.position)

  return ok({
    id: q.id as string,
    quote_number: q.quote_number as string,
    status: q.status as QuoteStatus,
    issue_date: q.issue_date as string,
    validity_date: q.validity_date as string,
    notes: (q.notes as string | null) ?? null,
    terms: (q.terms as string | null) ?? null,
    subtotal: Number(q.subtotal),
    tax_amount: Number(q.tax_amount),
    total: Number(q.total),
    converted_invoice_id: (q.converted_invoice_id as string | null) ?? null,
    clientName: (q.client as { name?: string } | null)?.name || 'N/A',
    items,
  })
}
