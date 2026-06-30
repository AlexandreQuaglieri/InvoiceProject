// Service e-invoicing 2026 — porte d'écriture unique de la conformité
// (transmission PDP, cycle de vie, e-reporting). Consommé par les routes API,
// les server actions et le cron de synchronisation.
//
// Le PdpProvider est INJECTÉ par l'appelant :
//   - routes utilisateur : superPdpForRequest (peut retomber sur l'app éditeur) ;
//   - cron / synchros persistantes : superPdpForUser STRICT (jamais le fallback
//     env, sinon on écrirait des données de l'app éditeur chez un client).
import { type DbClient, type Ctx, type ServiceResult, ok, err } from './core'
import type { PdpProvider } from '@/lib/pdp/provider'
import type { PdpB2cTransaction, PdpB2cPayment, PdpLifecycleEvent } from '@/lib/pdp/types'
import { buildInvoiceFacturX } from '@/lib/facturx/build'
import { PUSHABLE_CODES } from '@/lib/einvoicing/status'
import type { Company, InboundInvoice, InvoiceWithRelations } from '@/types/database'
import {
  notifyPdpTransmitted,
  notifyPdpStatus,
  notifyInboundReceived,
  notifyInboundDecision,
} from '@/lib/notifications/events'

export { TERMINAL_PDP_CODES } from '@/lib/einvoicing/status'

async function getInvoiceWithRelations(
  supabase: DbClient,
  ctx: Ctx,
  invoiceId: string
): Promise<InvoiceWithRelations | null> {
  const { data } = await supabase
    .from('invoices')
    .select('*, client:clients(*), items:invoice_items(*)')
    .eq('id', invoiceId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()
  return (data as InvoiceWithRelations | null) ?? null
}

export type TransmitResult = {
  depositId: string
  transmittedAt: string
  alreadyTransmitted: boolean
}

// Transmet une facture B2B (Factur-X) via la PDP. Idempotent : si la facture
// porte déjà un dépôt PDP, on ne retransmet pas (réponse explicite, pas une erreur).
export async function transmitInvoice(
  supabase: DbClient,
  ctx: Ctx,
  pdp: PdpProvider,
  input: { invoiceId: string }
): Promise<ServiceResult<TransmitResult>> {
  const invoice = await getInvoiceWithRelations(supabase, ctx, input.invoiceId)
  if (!invoice) return err('Facture non trouvée')

  if (invoice.status === 'draft') {
    return err("Impossible de transmettre un brouillon. Finalisez la facture d'abord.")
  }

  if (invoice.pdp_deposit_id) {
    return ok({
      depositId: invoice.pdp_deposit_id,
      transmittedAt: invoice.pdp_transmitted_at ?? '',
      alreadyTransmitted: true,
    })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', ctx.companyId)
    .maybeSingle()
  if (!company) return err('Entreprise non configurée')

  const facturX = await buildInvoiceFacturX(invoice, company as Company)
  const result = await pdp.transmitInvoice({ facturX, invoiceNumber: invoice.number })

  // Persiste la référence de dépôt (le Realtime propage la mise à jour à l'UI).
  const { error: updateError } = await supabase
    .from('invoices')
    .update({ pdp_deposit_id: result.depositId, pdp_transmitted_at: result.transmittedAt })
    .eq('id', invoice.id)
    .eq('company_id', ctx.companyId)

  if (updateError) {
    // La transmission a réussi côté PDP : on ne la transforme pas en échec,
    // mais on trace (l'idempotence locale ne protégera pas le prochain clic).
    console.error('[einvoicing] persistance du dépôt PDP en échec', {
      invoiceId: invoice.id,
      depositId: result.depositId,
    }, updateError)
  }

  // Notification best-effort (propriétaire du compte) : facture transmise.
  await notifyPdpTransmitted(supabase, ctx.companyId, invoice, result.depositId, result.transmittedAt)

  return ok({ depositId: result.depositId, transmittedAt: result.transmittedAt, alreadyTransmitted: false })
}

export type LifecycleSyncResult = {
  transmitted: boolean
  depositId?: string
  events: PdpLifecycleEvent[]
}

// Récupère le cycle de vie PDP d'une facture et persiste le dernier statut
// connu (pdp_status / pdp_status_text / pdp_status_at) — le Realtime propage.
export async function syncInvoiceLifecycle(
  supabase: DbClient,
  ctx: Ctx,
  pdp: PdpProvider,
  input: { invoiceId: string }
): Promise<ServiceResult<LifecycleSyncResult>> {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, pdp_deposit_id, pdp_status, pdp_status_at')
    .eq('id', input.invoiceId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!invoice) return err('Facture non trouvée')

  const row = invoice as {
    id: string
    pdp_deposit_id: string | null
    pdp_status?: string | null
    pdp_status_at?: string | null
  }

  if (!row.pdp_deposit_id) return ok({ transmitted: false, events: [] })

  const events = await pdp.getLifecycle(row.pdp_deposit_id)
  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  const latest = sorted[sorted.length - 1]

  if (latest && (latest.statusCode !== row.pdp_status || latest.occurredAt !== row.pdp_status_at)) {
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        pdp_status: latest.statusCode,
        pdp_status_text: latest.statusText ?? null,
        pdp_status_at: latest.occurredAt,
      })
      .eq('id', row.id)
      .eq('company_id', ctx.companyId)

    if (updateError) {
      // Best-effort : la timeline reste servie même si la persistance échoue
      // (ex. migration pdp_status pas encore appliquée).
      console.error('[einvoicing] persistance du statut PDP en échec', { invoiceId: row.id }, updateError)
    }

    // Notification best-effort : le statut PDP a changé (acceptée / refusée /
    // encaissée / rejetée). No-op si le code n'est pas notable.
    await notifyPdpStatus(
      supabase,
      ctx.companyId,
      row.id,
      latest.statusCode,
      latest.statusText ?? null,
      latest.occurredAt
    )
  }

  return ok({ transmitted: true, depositId: row.pdp_deposit_id, events: sorted })
}

// Agrège la TVA d'une facture par taux (partagé transaction / paiement B2C).
export function aggregateVatByRate(invoice: InvoiceWithRelations): Array<{
  rate: number
  taxableAmount: number
  taxTotal: number
}> {
  const byRate = new Map<number, { ht: number; vat: number }>()
  for (const item of invoice.items ?? []) {
    const rate = Number(item.vat_rate)
    const cur = byRate.get(rate) ?? { ht: 0, vat: 0 }
    cur.ht += Number(item.total_ht)
    cur.vat += Number(item.total_vat)
    byRate.set(rate, cur)
  }
  return [...byRate.entries()].map(([rate, v]) => ({
    rate,
    taxableAmount: v.ht,
    taxTotal: v.vat,
  }))
}

export type EreportResult = { id: string; alreadyReported: boolean }

// Déclare une facture B2C (vente à un particulier) en e-reporting.
// Idempotent une fois la colonne pdp_ereport_id en place (lot 3).
export async function ereportB2cTransaction(
  supabase: DbClient,
  ctx: Ctx,
  pdp: PdpProvider,
  input: { invoiceId: string }
): Promise<ServiceResult<EreportResult>> {
  const invoice = await getInvoiceWithRelations(supabase, ctx, input.invoiceId)
  if (!invoice) return err('Facture non trouvée')

  if (invoice.client?.type !== 'individual') {
    return err(
      "L'e-reporting concerne les ventes aux particuliers (B2C). Une facture professionnelle se transmet via la PDP."
    )
  }
  if (invoice.status === 'draft') {
    return err('Finalisez la facture avant de la déclarer.')
  }

  // Idempotence : déjà déclarée → on ne recrée pas de transaction.
  if (invoice.pdp_ereport_id) {
    return ok({ id: invoice.pdp_ereport_id, alreadyReported: true })
  }

  const tx: PdpB2cTransaction = {
    category_code: 'TPS1', // prestation de services (défaut)
    currency: 'EUR',
    date: invoice.issue_date,
    role_code: 'SE',
    tax_exclusive_amount: Number(invoice.total_ht).toFixed(2),
    tax_total: Number(invoice.total_vat).toFixed(2),
    tax_subtotals: aggregateVatByRate(invoice).map((s) => ({
      tax_percent: String(s.rate),
      taxable_amount: s.taxableAmount.toFixed(2),
      tax_total: s.taxTotal.toFixed(2),
    })),
  }

  const result = await pdp.reportB2cTransaction(tx)

  const { error: updateError } = await supabase
    .from('invoices')
    .update({ pdp_ereport_id: String(result.id), pdp_ereported_at: new Date().toISOString() })
    .eq('id', invoice.id)
    .eq('company_id', ctx.companyId)

  if (updateError) {
    console.error('[einvoicing] persistance e-reporting en échec', { invoiceId: invoice.id }, updateError)
  }

  return ok({ id: String(result.id), alreadyReported: false })
}

export type PaymentReportResult =
  | { kind: 'skipped'; reason: 'not_paid' | 'draft' | 'already_reported' | 'nothing_to_report' }
  | { kind: 'b2c_payment'; id: string }
  | { kind: 'b2b_status'; depositId: string }

// Déclare l'encaissement d'une facture passée à « payée » :
//   - B2C (client particulier) : POST b2c_payments (e-reporting des paiements,
//     obligatoire pour les prestations de services) ;
//   - B2B transmise : pousse l'event fr:212 « Paiement reçu » (Encaissée) sur le
//     cycle de vie — un des 4 statuts obligatoires de la réforme.
// Idempotent via invoices.pdp_payment_reported_at. Appelé hors chemin critique
// (after() dans updateInvoiceStatusAction).
export async function reportPaymentForInvoice(
  supabase: DbClient,
  ctx: Ctx,
  pdp: PdpProvider,
  input: { invoiceId: string }
): Promise<ServiceResult<PaymentReportResult>> {
  const invoice = await getInvoiceWithRelations(supabase, ctx, input.invoiceId)
  if (!invoice) return err('Facture non trouvée')

  if (invoice.status !== 'paid') return ok({ kind: 'skipped', reason: 'not_paid' })
  if (invoice.pdp_payment_reported_at) return ok({ kind: 'skipped', reason: 'already_reported' })

  const paidDate = (invoice.paid_at ?? new Date().toISOString()).split('T')[0]

  if (invoice.client?.type === 'individual') {
    const payment: PdpB2cPayment = {
      date: paidDate,
      subtotals: aggregateVatByRate(invoice).map((s) => ({
        category_code: 'TPS1' as const,
        tax_percent: String(s.rate),
        amount: (s.taxableAmount + s.taxTotal).toFixed(2),
        currency_code: 'EUR',
      })),
    }
    const result = await pdp.reportB2cPayment(payment)

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        pdp_payment_report_id: String(result.id),
        pdp_payment_reported_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)
      .eq('company_id', ctx.companyId)
    if (updateError) {
      console.error('[einvoicing] persistance paiement B2C en échec', { invoiceId: invoice.id }, updateError)
    }

    return ok({ kind: 'b2c_payment', id: String(result.id) })
  }

  if (invoice.pdp_deposit_id) {
    await pdp.pushStatus(invoice.pdp_deposit_id, PUSHABLE_CODES.paymentReceived)

    const { error: updateError } = await supabase
      .from('invoices')
      .update({ pdp_payment_reported_at: new Date().toISOString() })
      .eq('id', invoice.id)
      .eq('company_id', ctx.companyId)
    if (updateError) {
      console.error('[einvoicing] persistance encaissement B2B en échec', { invoiceId: invoice.id }, updateError)
    }

    return ok({ kind: 'b2b_status', depositId: invoice.pdp_deposit_id })
  }

  // B2B non transmise : rien à déclarer côté PDP.
  return ok({ kind: 'skipped', reason: 'nothing_to_report' })
}

// ---- Réception (factures entrantes) ----

export type InboundSyncResult = { fetched: number; upserted: number }

// Synchronise les factures entrantes de la PDP vers inbound_invoices.
// Upsert sur (company_id, deposit_id) — ne touche JAMAIS local_status /
// refusal_reason (décisions de l'acheteur). Les nouvelles lignes arrivent à
// l'UI par Realtime.
// ⚠️ À appeler UNIQUEMENT avec un provider raccordé à la société de
// l'utilisateur (superPdpForUser) — jamais le fallback éditeur, sinon on
// persisterait l'inbox de l'app éditeur chez un client.
export async function syncInbound(
  supabase: DbClient,
  ctx: Ctx,
  pdp: PdpProvider
): Promise<ServiceResult<InboundSyncResult>> {
  const inbound = await pdp.listInbound()
  if (inbound.length === 0) return ok({ fetched: 0, upserted: 0 })

  const rows = inbound.map((inv) => ({
    company_id: ctx.companyId,
    deposit_id: inv.depositId,
    external_id: inv.externalId ?? null,
    number: inv.number ?? null,
    seller_name: inv.sellerName ?? null,
    seller_vat: inv.sellerVat ?? null,
    total_with_vat: inv.totalWithVat ?? null,
    currency: inv.currency ?? null,
    issue_date: inv.issueDate ?? null,
    received_at: inv.receivedAt,
  }))

  // Factures déjà connues, pour ne notifier QUE les nouvelles.
  const { data: existingRows } = await supabase
    .from('inbound_invoices')
    .select('deposit_id')
    .eq('company_id', ctx.companyId)
  const known = new Set((existingRows ?? []).map((r) => (r as { deposit_id: string }).deposit_id))

  // onConflict met à jour les métadonnées uniquement : local_status et
  // refusal_reason ne figurent pas dans le payload, ils sont donc préservés.
  const { error } = await supabase
    .from('inbound_invoices')
    .upsert(rows, { onConflict: 'company_id,deposit_id' })

  if (error) return err(`Erreur de synchronisation des factures reçues: ${error.message}`)

  // Notification best-effort : « vous avez reçu une facture » (nouvelles uniquement).
  for (const inv of inbound) {
    if (!known.has(inv.depositId)) {
      await notifyInboundReceived(supabase, ctx.companyId, {
        number: inv.number ?? null,
        seller_name: inv.sellerName ?? null,
        total_with_vat: inv.totalWithVat ?? null,
        currency: inv.currency ?? null,
        issue_date: inv.issueDate ?? null,
      })
    }
  }

  return ok({ fetched: inbound.length, upserted: rows.length })
}

export type InboundAction = 'approve' | 'refuse'

// Décision de l'acheteur sur une facture reçue : pousse le statut du cycle de
// vie à la PDP (fr:205 Approuvée / fr:210 Refusée + motif) puis persiste la
// décision locale. Realtime propage la mise à jour.
export async function setInboundStatus(
  supabase: DbClient,
  ctx: Ctx,
  pdp: PdpProvider,
  input: { inboundId: string; action: InboundAction; reason?: string }
): Promise<ServiceResult<InboundInvoice>> {
  const { data: inbound } = await supabase
    .from('inbound_invoices')
    .select('*')
    .eq('id', input.inboundId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!inbound) return err('Facture reçue non trouvée')

  const row = inbound as InboundInvoice
  if (row.local_status !== 'new') {
    return err('Cette facture a déjà été traitée (approuvée ou refusée).')
  }
  if (input.action === 'refuse' && !input.reason?.trim()) {
    return err('Un motif est obligatoire pour refuser une facture.')
  }

  const statusCode =
    input.action === 'approve' ? PUSHABLE_CODES.approved : PUSHABLE_CODES.refused
  await pdp.pushStatus(row.deposit_id, statusCode, input.reason?.trim() || undefined)

  const { data: updated, error } = await supabase
    .from('inbound_invoices')
    .update({
      local_status: input.action === 'approve' ? 'approved' : 'refused',
      refusal_reason: input.action === 'refuse' ? input.reason?.trim() : null,
      pdp_status: statusCode,
    })
    .eq('id', row.id)
    .eq('company_id', ctx.companyId)
    .select()
    .single()

  if (error) return err(`Statut poussé à la PDP mais persistance locale en échec: ${error.message}`)

  // Notification best-effort : facture reçue approuvée / refusée.
  await notifyInboundDecision(supabase, ctx.companyId, updated as InboundInvoice)

  return ok(updated as InboundInvoice)
}
