// Notifications métier — Niveau 1 : Quatools → propriétaire du compte (l'entreprise
// cliente). Émis vers le hub, depuis le compte Factur-IA (org unique). Le destinataire
// est l'email du compte (companies.email) ; les mails sont configurés côté hub par
// l'opérateur. TOUT est best-effort : aucune erreur ne remonte, jamais bloquant.
//
// Le Niveau 2 (entreprise → SON client, « une facture vous a été envoyée », marque
// blanche) viendra avec 1 org par entreprise et n'est PAS géré ici.
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureOrg, emitHubEvent, type HubRecipient } from './hub'
import type { InvoiceWithRelations, QuoteWithRelations, Client, InboundInvoice } from '@/types/database'

type Db = SupabaseClient

async function ownerRecipients(supabase: Db, companyId: string): Promise<HubRecipient[]> {
  const { data } = await supabase
    .from('companies')
    .select('email, user_id, name')
    .eq('id', companyId)
    .maybeSingle()
  const row = data as { email: string | null; user_id: string | null; name: string | null } | null
  if (!row?.email) return []
  return [{ email: row.email, app_user_id: row.user_id ?? undefined, name: row.name ?? undefined }]
}

// Émet un événement au propriétaire du compte concerné. Best-effort + silencieux
// si le hub n'est pas configuré.
async function notifyOwner(
  supabase: Db,
  companyId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    if (!process.env.NOTIFICATION_HUB_URL || !process.env.NOTIFICATION_API_KEY) return
    const orgId = await ensureOrg()
    if (!orgId) return
    const recipients = await ownerRecipients(supabase, companyId)
    await emitHubEvent({ event, orgId, recipients, payload })
  } catch (e) {
    console.error('[notify] émission en échec', { event }, e)
  }
}

// ---- Factures ----

const INVOICE_STATUS_EVENT: Partial<Record<string, string>> = {
  sent: 'facturia.invoice.sent',
  paid: 'facturia.invoice.paid',
  overdue: 'facturia.invoice.overdue',
  cancelled: 'facturia.invoice.cancelled',
}

export async function notifyInvoiceStatus(
  supabase: Db,
  companyId: string,
  invoice: InvoiceWithRelations
): Promise<void> {
  const event = INVOICE_STATUS_EVENT[invoice.status]
  if (!event) return
  await notifyOwner(supabase, companyId, event, {
    number: invoice.number,
    total_ttc: invoice.total_ttc,
    client_name: invoice.client?.name ?? '',
    client_email: invoice.client?.email ?? '',
    due_date: invoice.due_date,
    paid_at: invoice.paid_at ?? '',
  })
}

// ---- Devis ----

const QUOTE_STATUS_EVENT: Partial<Record<string, string>> = {
  sent: 'facturia.quote.sent',
  accepted: 'facturia.quote.accepted',
  rejected: 'facturia.quote.rejected',
  expired: 'facturia.quote.expired',
}

export async function notifyQuoteStatus(
  supabase: Db,
  companyId: string,
  quote: QuoteWithRelations
): Promise<void> {
  const event = QUOTE_STATUS_EVENT[quote.status]
  if (!event) return
  await notifyOwner(supabase, companyId, event, {
    quote_number: quote.quote_number,
    total: quote.total,
    client_name: quote.client?.name ?? '',
    client_email: quote.client?.email ?? '',
    validity_date: quote.validity_date,
  })
}

export async function notifyQuoteConverted(
  supabase: Db,
  companyId: string,
  quote: QuoteWithRelations,
  invoiceNumber: string
): Promise<void> {
  await notifyOwner(supabase, companyId, 'facturia.quote.converted', {
    quote_number: quote.quote_number,
    invoice_number: invoiceNumber,
    total: quote.total,
  })
}

// ---- Clients ----

export async function notifyClientCreated(supabase: Db, companyId: string, client: Client): Promise<void> {
  await notifyOwner(supabase, companyId, 'facturia.client.created', {
    name: client.name,
    type: client.type,
    email: client.email ?? '',
  })
}

// ---- PDP (e-invoicing sortant) ----

export async function notifyPdpTransmitted(
  supabase: Db,
  companyId: string,
  invoice: InvoiceWithRelations,
  depositId: string,
  transmittedAt: string
): Promise<void> {
  await notifyOwner(supabase, companyId, 'facturia.pdp.transmitted', {
    number: invoice.number,
    total_ttc: invoice.total_ttc,
    client_name: invoice.client?.name ?? '',
    deposit_id: depositId,
    transmitted_at: transmittedAt,
  })
}

const PDP_STATUS_EVENT: Record<string, string> = {
  'fr:205': 'facturia.pdp.accepted',
  'fr:210': 'facturia.pdp.refused',
  'fr:212': 'facturia.pdp.collected',
  'fr:213': 'facturia.pdp.rejected',
  'fr:501': 'facturia.pdp.rejected',
}

// Émet l'événement PDP correspondant au nouveau statut AFNOR (no-op si non notable).
export async function notifyPdpStatus(
  supabase: Db,
  companyId: string,
  invoiceId: string,
  statusCode: string,
  statusText: string | null,
  occurredAt: string
): Promise<void> {
  const event = PDP_STATUS_EVENT[statusCode]
  if (!event) return
  const { data } = await supabase
    .from('invoices')
    .select('number, total_ttc, client:clients(name)')
    .eq('id', invoiceId)
    .maybeSingle()
  const inv = data as { number: string; total_ttc: number; client: { name: string } | null } | null
  await notifyOwner(supabase, companyId, event, {
    number: inv?.number ?? '',
    total_ttc: inv?.total_ttc ?? 0,
    client_name: inv?.client?.name ?? '',
    status_text: statusText ?? '',
    occurred_at: occurredAt,
  })
}

// ---- Réception (inbox) ----

export async function notifyInboundReceived(
  supabase: Db,
  companyId: string,
  inv: {
    number: string | null
    seller_name: string | null
    total_with_vat: number | null
    currency: string | null
    issue_date: string | null
  }
): Promise<void> {
  await notifyOwner(supabase, companyId, 'facturia.inbox.received', {
    number: inv.number ?? '',
    seller_name: inv.seller_name ?? '',
    total_with_vat: inv.total_with_vat ?? 0,
    currency: inv.currency ?? 'EUR',
    issue_date: inv.issue_date ?? '',
  })
}

const INBOUND_DECISION_EVENT: Partial<Record<string, string>> = {
  approved: 'facturia.inbox.approved',
  refused: 'facturia.inbox.refused',
}

export async function notifyInboundDecision(
  supabase: Db,
  companyId: string,
  inbound: InboundInvoice
): Promise<void> {
  const event = INBOUND_DECISION_EVENT[inbound.local_status]
  if (!event) return
  await notifyOwner(supabase, companyId, event, {
    number: inbound.number ?? '',
    seller_name: inbound.seller_name ?? '',
    total_with_vat: inbound.total_with_vat ?? 0,
    refusal_reason: inbound.refusal_reason ?? '',
  })
}

// ---- Raccordement PDP ----

export async function notifyPdpConnected(
  supabase: Db,
  companyId: string,
  info: { companyName: string | null; companyNumber: string | null; env: string | null }
): Promise<void> {
  await notifyOwner(supabase, companyId, 'facturia.pdp.connected', {
    pdp_company_name: info.companyName ?? '',
    pdp_company_number: info.companyNumber ?? '',
    pdp_env: info.env ?? '',
  })
}
