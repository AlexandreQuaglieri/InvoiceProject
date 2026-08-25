import { createHmac } from 'crypto'

// Intégration au hub de notification Quatools (hub.quatools.fr).
//   - /api/notifications/orgs     POST  { name, external_id } -> { org_id, created }  (idempotent par app+external_id)
//   - /api/notifications/register POST  { events: [...] }      -> { registered, ... }  (idempotent par slug)
//   - /api/notifications/emit     POST  { event, org_id, payload, recipients }
//   - /api/link-admin?token=...   (token signé HMAC SIGNING_SECRET) -> l'utilisateur devient admin de l'org
// Tout est INERTE si NOTIFICATION_HUB_URL / NOTIFICATION_API_KEY ne sont pas posées.

export const SUPPORT_EVENT = 'facturia.support.message_created'
export const LEAD_EVENT = 'facturia.lead.created'
export const WELCOME_EVENT = 'facturia.user.welcomed'
const ORG_EXTERNAL_ID = 'factur-ia'
const ORG_NAME = 'Factur-IA'

function hubBase(): string | null {
  return process.env.NOTIFICATION_HUB_URL?.replace(/\/$/, '') ?? null
}

async function hubFetch(path: string, body: unknown): Promise<Response | null> {
  const base = hubBase()
  const apiKey = process.env.NOTIFICATION_API_KEY
  if (!base || !apiKey) return null
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
}

// Crée/récupère l'org de l'app (idempotent) → org_id, ou null si non configuré/échec.
// Mémoïsé par process : l'org est stable, inutile de rappeler /orgs à chaque emit.
let cachedOrgId: string | null = null
export async function ensureOrg(): Promise<string | null> {
  if (cachedOrgId) return cachedOrgId
  try {
    const res = await hubFetch('/api/notifications/orgs', {
      external_id: ORG_EXTERNAL_ID,
      name: ORG_NAME,
    })
    if (!res) return null
    if (!res.ok) {
      console.error('[hub] orgs en échec', res.status, await res.text())
      return null
    }
    const data = (await res.json()) as { org_id?: string }
    cachedOrgId = data.org_id ?? null
    return cachedOrgId
  } catch (e) {
    console.error('[hub] orgs en échec', e)
    return null
  }
}

// Niveau 2 (marque blanche) : une org PAR entreprise cliente. Idempotent par
// external_id `company-<id>` ; mémoïsé par process. → l'entreprise administre SON
// org (identité d'envoi propre) et configure les mails à SES clients.
const companyOrgCache = new Map<string, string>()
export async function ensureCompanyOrg(companyId: string, companyName: string): Promise<string | null> {
  const cached = companyOrgCache.get(companyId)
  if (cached) return cached
  try {
    const res = await hubFetch('/api/notifications/orgs', {
      external_id: `company-${companyId}`,
      name: companyName || 'Entreprise',
    })
    if (!res) return null
    if (!res.ok) {
      console.error('[hub] org entreprise en échec', res.status, await res.text())
      return null
    }
    const data = (await res.json()) as { org_id?: string }
    if (data.org_id) companyOrgCache.set(companyId, data.org_id)
    return data.org_id ?? null
  } catch (e) {
    console.error('[hub] org entreprise en échec', e)
    return null
  }
}

type HubEventDef = {
  slug: string
  label: string
  category: 'billing' | 'member' | 'team' | 'shop' | 'system'
  supported_channels: Array<'email' | 'discord_webhook' | 'discord_dm'>
  audiences: string[]
  description: string
  default_active: boolean
  payload_schema: Record<string, string>
}

const CH: HubEventDef['supported_channels'] = ['email', 'discord_webhook', 'discord_dm']

// Catalogue complet des événements émis par Factur-IA, déclaré au hub (idempotent
// par slug). category ∈ {billing, member, team, shop, system} ; canaux ∈
// {email, discord_webhook, discord_dm}. Les clés de payload_schema deviennent les
// variables {{...}} utilisables dans les templates (mail/Discord) côté hub.
export const APP_EVENTS: HubEventDef[] = [
  // — Système —
  {
    slug: SUPPORT_EVENT,
    label: 'Nouveau message support',
    category: 'system',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Un utilisateur a écrit via le bouton Assistance.',
    default_active: true,
    payload_schema: { subject: 'string', message: 'string', author_email: 'string', author_id: 'string' },
  },
  {
    slug: WELCOME_EVENT,
    label: 'Bienvenue (nouveau compte)',
    category: 'member',
    supported_channels: CH,
    audiences: ['member'],
    description: 'Un nouveau compte vient d’être créé — email de bienvenue.',
    default_active: true,
    payload_schema: { email: 'string' },
  },
  {
    slug: LEAD_EVENT,
    label: 'Nouveau lead (quiz réforme)',
    category: 'system',
    supported_channels: CH,
    // member = le lead lui-même (envoi de la checklist), admin = notification interne.
    audiences: ['admin', 'member'],
    description: "Un visiteur a laissé son email à l'issue du quiz « Suis-je concerné par 2026 ? ».",
    default_active: true,
    payload_schema: { email: 'string', quiz_who: 'string', quiz_billing: 'string', locale: 'string' },
  },
  {
    slug: 'facturia.pdp.connected',
    label: 'Plateforme (PDP) raccordée',
    category: 'system',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Le compte a raccordé sa société à la plateforme de dématérialisation.',
    default_active: true,
    payload_schema: { pdp_company_name: 'string', pdp_company_number: 'string', pdp_env: 'string' },
  },

  // — Factures —
  {
    slug: 'facturia.invoice.sent',
    label: 'Facture envoyée',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Une facture a été finalisée / envoyée au client.',
    default_active: true,
    // seller_name : nom de l'entreprise émettrice (pour le mail client, Niveau 2).
    payload_schema: { number: 'string', total_ttc: 'number', seller_name: 'string', client_name: 'string', client_email: 'string', due_date: 'string' },
  },
  {
    slug: 'facturia.invoice.paid',
    label: 'Facture payée',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Une facture a été encaissée (passée à « payée »).',
    default_active: true,
    payload_schema: { number: 'string', total_ttc: 'number', client_name: 'string', paid_at: 'string' },
  },
  {
    slug: 'facturia.invoice.overdue',
    label: 'Facture en retard',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Une facture envoyée a dépassé sa date d’échéance sans paiement.',
    default_active: true,
    payload_schema: { number: 'string', total_ttc: 'number', client_name: 'string', client_email: 'string', due_date: 'string' },
  },
  {
    slug: 'facturia.invoice.cancelled',
    label: 'Facture annulée',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Une facture a été annulée.',
    default_active: true,
    payload_schema: { number: 'string', total_ttc: 'number', client_name: 'string' },
  },

  // — Devis —
  {
    slug: 'facturia.quote.sent',
    label: 'Devis envoyé',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Un devis a été envoyé au client.',
    default_active: true,
    // seller_name : nom de l'entreprise émettrice (pour le mail client, Niveau 2).
    payload_schema: { quote_number: 'string', total: 'number', seller_name: 'string', client_name: 'string', client_email: 'string', validity_date: 'string' },
  },
  {
    slug: 'facturia.quote.accepted',
    label: 'Devis accepté',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Un devis a été accepté par le client.',
    default_active: true,
    payload_schema: { quote_number: 'string', total: 'number', client_name: 'string' },
  },
  {
    slug: 'facturia.quote.rejected',
    label: 'Devis refusé',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Un devis a été refusé par le client.',
    default_active: true,
    payload_schema: { quote_number: 'string', total: 'number', client_name: 'string' },
  },
  {
    slug: 'facturia.quote.expired',
    label: 'Devis expiré',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Un devis a dépassé sa date de validité.',
    default_active: true,
    payload_schema: { quote_number: 'string', total: 'number', client_name: 'string', validity_date: 'string' },
  },
  {
    slug: 'facturia.quote.converted',
    label: 'Devis converti en facture',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Un devis accepté a été converti en facture.',
    default_active: true,
    payload_schema: { quote_number: 'string', invoice_number: 'string', total: 'number' },
  },

  // — PDP / e-invoicing (sortant) —
  {
    slug: 'facturia.pdp.transmitted',
    label: 'Facture transmise à la PDP',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Une facture a été déposée avec succès sur la plateforme (PDP).',
    default_active: true,
    payload_schema: { number: 'string', total_ttc: 'number', client_name: 'string', deposit_id: 'string', transmitted_at: 'string' },
  },
  {
    slug: 'facturia.pdp.transmit_failed',
    label: 'Échec de transmission PDP',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'La transmission d’une facture à la plateforme a échoué.',
    default_active: true,
    payload_schema: { number: 'string', error: 'string' },
  },
  {
    slug: 'facturia.pdp.accepted',
    label: 'Facture acceptée (PDP)',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Le client a approuvé la facture sur la plateforme (AFNOR fr:205).',
    default_active: true,
    payload_schema: { number: 'string', status_text: 'string', occurred_at: 'string', client_name: 'string' },
  },
  {
    slug: 'facturia.pdp.refused',
    label: 'Facture refusée (PDP)',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Le client a refusé la facture sur la plateforme (AFNOR fr:210).',
    default_active: true,
    payload_schema: { number: 'string', status_text: 'string', occurred_at: 'string', client_name: 'string' },
  },
  {
    slug: 'facturia.pdp.collected',
    label: 'Facture encaissée (PDP)',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Le paiement de la facture a été constaté sur la plateforme (AFNOR fr:212).',
    default_active: true,
    payload_schema: { number: 'string', total_ttc: 'number', occurred_at: 'string', client_name: 'string' },
  },
  {
    slug: 'facturia.pdp.rejected',
    label: 'Facture rejetée (PDP)',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'La facture a été rejetée par la plateforme (non conforme).',
    default_active: true,
    payload_schema: { number: 'string', status_text: 'string', occurred_at: 'string' },
  },

  // — Réception (e-invoicing entrant) —
  {
    slug: 'facturia.inbox.received',
    label: 'Facture reçue',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Une facture fournisseur a été reçue via la plateforme.',
    default_active: true,
    payload_schema: { number: 'string', seller_name: 'string', total_with_vat: 'number', currency: 'string', issue_date: 'string' },
  },
  {
    slug: 'facturia.inbox.approved',
    label: 'Facture reçue approuvée',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Une facture fournisseur reçue a été approuvée.',
    default_active: true,
    payload_schema: { number: 'string', seller_name: 'string', total_with_vat: 'number' },
  },
  {
    slug: 'facturia.inbox.refused',
    label: 'Facture reçue refusée',
    category: 'billing',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Une facture fournisseur reçue a été refusée (avec motif).',
    default_active: true,
    payload_schema: { number: 'string', seller_name: 'string', refusal_reason: 'string' },
  },

  // — Clients —
  {
    slug: 'facturia.client.created',
    label: 'Nouveau client',
    category: 'member',
    supported_channels: CH,
    audiences: ['admin'],
    description: 'Un nouveau client a été créé.',
    default_active: true,
    payload_schema: { name: 'string', type: 'string', email: 'string' },
  },
]

// Déclare TOUT le catalogue (idempotent par slug). `app` est désormais déduit de la
// clé côté hub ; on l'envoie quand même s'il est connu (ignoré sinon).
export async function registerEvents(app?: string): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const res = await hubFetch('/api/notifications/register', {
      ...(app ? { app } : {}),
      events: APP_EVENTS,
    })
    if (!res) return { ok: false, status: 0, body: 'Intégration non configurée' }
    const text = await res.text()
    return { ok: res.ok, status: res.status, body: text }
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e) }
  }
}

// Auto-déclaration du catalogue au démarrage (instrumentation). Best-effort : ne
// tourne que si le hub est configuré ; aucune erreur ne remonte, juste un log.
export async function registerAppEvents(): Promise<void> {
  if (!hubBase() || !process.env.NOTIFICATION_API_KEY) return
  const res = await registerEvents(process.env.NOTIFICATION_APP)
  if (!res.ok) console.error('[hub] auto-déclaration des events échouée', res.status, res.body)
}

export type HubRecipient = {
  app_user_id?: string
  email?: string
  discord_id?: string
  name?: string
}

// Émet un événement. org_id est REQUIS par le hub (pas déduit de la clé).
export async function emitHubEvent(input: {
  event: string
  orgId: string
  payload: Record<string, unknown>
  recipients?: HubRecipient[]
}): Promise<void> {
  if (!input.orgId) return
  try {
    const res = await hubFetch('/api/notifications/emit', {
      event: input.event,
      org_id: input.orgId,
      recipients: input.recipients ?? [],
      payload: input.payload,
    })
    if (res && !res.ok) {
      console.error('[hub] émission en échec', { event: input.event, status: res.status }, await res.text())
    }
  } catch (e) {
    console.error('[hub] émission en échec', { event: input.event }, e)
  }
}

// --- Lien d'association admin (token signé localement) ---

function mintLinkToken(payload: Record<string, unknown>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

// URL d'association admin pour l'org donnée, ou null si non configuré.
// `app` = identifiant de l'app (pas un secret) — fourni par l'appelant.
export function buildAdminLinkUrl(opts: {
  app: string
  orgId: string
  appUserId: string
  email?: string
}): string | null {
  const base = hubBase()
  const secret = process.env.NOTIFICATION_SIGNING_SECRET
  if (!base || !secret || !opts.app) return null
  const token = mintLinkToken(
    {
      app: opts.app,
      app_user_id: opts.appUserId,
      scope: 'admin',
      org_id: opts.orgId,
      ...(opts.email ? { email: opts.email } : {}),
      exp: Math.floor(Date.now() / 1000) + 120,
    },
    secret
  )
  return `${base}/api/link-admin?token=${encodeURIComponent(token)}`
}
