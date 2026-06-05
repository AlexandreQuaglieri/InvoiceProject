// Service Factures — création / changement de statut / suppression + résolution par numéro.
// Numérotation et totaux canoniques (déclencheurs DB pour les totaux de facture).
import { type DbClient, type Ctx, type ServiceResult, ok, err, getOrCreateUserSettings } from './core'
import { generateInvoiceNumber, calculateLineTotal } from '@/lib/validations/invoice'
import type { InvoiceStatus } from '@/types/database'

export type InvoiceItemInput = {
  description: string
  quantity: number
  unit_price: number
  vat_rate?: number
}

export type CreateInvoiceInput = {
  client_id: string
  items: InvoiceItemInput[]
  issue_date?: string
  due_date?: string
  payment_terms?: string | null
  notes?: string | null
  discount_type?: 'percentage' | 'amount' | null
  discount_value?: number
}

export type CreatedInvoice = {
  id: string
  number: string
  clientName: string
  total_ttc: number
}

export async function create(
  supabase: DbClient,
  ctx: Ctx,
  input: CreateInvoiceInput
): Promise<ServiceResult<CreatedInvoice>> {
  // Vérifier que le client appartient à l'entreprise
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', input.client_id)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!client) return err('Client non trouvé (vérifie client_id).')

  const settings = await getOrCreateUserSettings(supabase, ctx.userId)
  if (!settings) return err('Impossible de récupérer les paramètres de numérotation.')

  const invoiceNumber = generateInvoiceNumber(
    settings.invoice_prefix || 'FAC',
    settings.invoice_next_number || 1
  )

  const today = new Date().toISOString().split('T')[0]
  const defaultDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Créer la facture (les totaux sont recalculés par les déclencheurs DB à l'insertion des lignes)
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id: ctx.companyId,
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

  if (invoiceError) return err(`Erreur création facture: ${invoiceError.message}`)

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
    return err(`Erreur création des lignes: ${itemsError.message}`)
  }

  await supabase
    .from('user_settings')
    .update({ invoice_next_number: (settings.invoice_next_number || 1) + 1 })
    .eq('user_id', ctx.userId)

  // Relire le total finalisé par les déclencheurs
  const { data: final } = await supabase
    .from('invoices')
    .select('total_ttc')
    .eq('id', invoice.id)
    .maybeSingle()

  return ok({
    id: invoice.id,
    number: invoice.number,
    clientName: client.name,
    total_ttc: Number(final?.total_ttc ?? 0),
  })
}

export async function findByNumber(
  supabase: DbClient,
  ctx: Ctx,
  number: string
): Promise<ServiceResult<{ id: string; number: string; status: InvoiceStatus }>> {
  const { data } = await supabase
    .from('invoices')
    .select('id, number, status')
    .eq('company_id', ctx.companyId)
    .ilike('number', `%${number}%`)
    .limit(1)

  if (!data || data.length === 0) return err(`Facture "${number}" non trouvée.`)
  return ok(data[0] as { id: string; number: string; status: InvoiceStatus })
}

export async function setStatus(
  supabase: DbClient,
  ctx: Ctx,
  invoiceId: string,
  status: InvoiceStatus
): Promise<ServiceResult<{ id: string; number: string; oldStatus: InvoiceStatus }>> {
  const { data: existing } = await supabase
    .from('invoices')
    .select('id, number, status')
    .eq('id', invoiceId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!existing) return err('Facture non trouvée.')

  const { error } = await supabase
    .from('invoices')
    .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
    .eq('id', invoiceId)
    .eq('company_id', ctx.companyId)

  if (error) return err(error.message)
  return ok({ id: existing.id, number: existing.number, oldStatus: existing.status })
}

// Supprime une facture (uniquement les brouillons).
export async function remove(
  supabase: DbClient,
  ctx: Ctx,
  invoiceId: string
): Promise<ServiceResult<{ number: string }>> {
  const { data: existing } = await supabase
    .from('invoices')
    .select('id, number, status')
    .eq('id', invoiceId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!existing) return err('Facture non trouvée.')
  if (existing.status !== 'draft') {
    return err('Seuls les brouillons peuvent être supprimés.')
  }

  await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('company_id', ctx.companyId)

  if (error) return err(error.message)
  return ok({ number: existing.number })
}

// ---- Lecture ----

export type InvoiceListItem = {
  id: string
  number: string
  status: InvoiceStatus
  total_ttc: number
  due_date: string
  clientName: string
}

export async function list(
  supabase: DbClient,
  ctx: Ctx,
  opts: { status?: InvoiceStatus; clientName?: string; limit?: number } = {}
): Promise<ServiceResult<InvoiceListItem[]>> {
  let query = supabase
    .from('invoices')
    .select('id, number, status, total_ttc, due_date, client:clients(name)')
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false })

  if (opts.status) query = query.eq('status', opts.status)
  if (opts.limit) query = query.limit(opts.limit)

  const { data, error } = await query
  if (error) return err(error.message)

  let rows = (data ?? []) as Array<Record<string, unknown>>
  if (opts.clientName) {
    const needle = opts.clientName.toLowerCase()
    rows = rows.filter((inv) =>
      ((inv.client as { name?: string } | null)?.name || '').toLowerCase().includes(needle)
    )
  }

  return ok(
    rows.map((inv) => ({
      id: inv.id as string,
      number: inv.number as string,
      status: inv.status as InvoiceStatus,
      total_ttc: Number(inv.total_ttc),
      due_date: inv.due_date as string,
      clientName: (inv.client as { name?: string } | null)?.name || 'N/A',
    }))
  )
}

export type InvoiceDetail = {
  id: string
  number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string
  paid_at: string | null
  notes: string | null
  payment_terms: string | null
  total_ht: number
  total_vat: number
  total_ttc: number
  clientName: string
  items: Array<{
    description: string
    quantity: number
    unit_price: number
    vat_rate: number
    total_ttc: number
    position: number
  }>
}

export async function getById(
  supabase: DbClient,
  ctx: Ctx,
  invoiceId: string
): Promise<ServiceResult<InvoiceDetail>> {
  const { data: inv, error } = await supabase
    .from('invoices')
    .select(
      'id, number, status, issue_date, due_date, paid_at, notes, payment_terms, total_ht, total_vat, total_ttc, client:clients(name), items:invoice_items(description, quantity, unit_price, vat_rate, total_ttc, position)'
    )
    .eq('id', invoiceId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (error) return err(error.message)
  if (!inv) return err('Facture non trouvée.')

  const items = (((inv as Record<string, unknown>).items as Array<Record<string, unknown>>) || [])
    .map((it) => ({
      description: it.description as string,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      vat_rate: Number(it.vat_rate),
      total_ttc: Number(it.total_ttc),
      position: Number(it.position),
    }))
    .sort((a, b) => a.position - b.position)

  return ok({
    id: inv.id as string,
    number: inv.number as string,
    status: inv.status as InvoiceStatus,
    issue_date: inv.issue_date as string,
    due_date: inv.due_date as string,
    paid_at: (inv.paid_at as string | null) ?? null,
    notes: (inv.notes as string | null) ?? null,
    payment_terms: (inv.payment_terms as string | null) ?? null,
    total_ht: Number(inv.total_ht),
    total_vat: Number(inv.total_vat),
    total_ttc: Number(inv.total_ttc),
    clientName: (inv.client as { name?: string } | null)?.name || 'N/A',
    items,
  })
}

export type InvoiceStats = {
  total: number
  draft: number
  sent: number
  paid: number
  overdue: number
  cancelled: number
  totalPaid: number
  totalPending: number
  revenueThisMonth: number
  revenueThisYear: number
}

export async function stats(supabase: DbClient, ctx: Ctx): Promise<ServiceResult<InvoiceStats>> {
  const { data, error } = await supabase
    .from('invoices')
    .select('status, total_ttc, issue_date')
    .eq('company_id', ctx.companyId)

  if (error) return err(error.message)
  const invoices = (data ?? []) as Array<{
    status: InvoiceStatus
    total_ttc: number
    issue_date: string
  }>

  const by = (s: InvoiceStatus) => invoices.filter((i) => i.status === s)
  const sum = (rows: typeof invoices) => rows.reduce((acc, i) => acc + Number(i.total_ttc || 0), 0)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const paid = by('paid')
  const revenueThisYear = sum(paid.filter((i) => new Date(i.issue_date).getFullYear() === year))
  const revenueThisMonth = sum(
    paid.filter((i) => {
      const d = new Date(i.issue_date)
      return d.getFullYear() === year && d.getMonth() === month
    })
  )

  return ok({
    total: invoices.length,
    draft: by('draft').length,
    sent: by('sent').length,
    paid: paid.length,
    overdue: by('overdue').length,
    cancelled: by('cancelled').length,
    totalPaid: sum(paid),
    totalPending: sum(invoices.filter((i) => i.status === 'sent' || i.status === 'overdue')),
    revenueThisMonth,
    revenueThisYear,
  })
}
