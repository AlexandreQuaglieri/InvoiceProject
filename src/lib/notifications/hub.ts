import { createHmac } from 'crypto'

// Intégration au hub de notification Quatools (hub.quatools.fr).
//   - /api/notifications/orgs     POST  { name, external_id } -> { org_id, created }  (idempotent par app+external_id)
//   - /api/notifications/register POST  { events: [...] }      -> { registered, ... }  (idempotent par slug)
//   - /api/notifications/emit     POST  { event, org_id, payload, recipients }
//   - /api/link-admin?token=...   (token signé HMAC SIGNING_SECRET) -> l'utilisateur devient admin de l'org
// Tout est INERTE si NOTIFICATION_HUB_URL / NOTIFICATION_API_KEY ne sont pas posées.

export const SUPPORT_EVENT = 'facturia.support.message_created'
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
export async function ensureOrg(): Promise<string | null> {
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
    return data.org_id ?? null
  } catch (e) {
    console.error('[hub] orgs en échec', e)
    return null
  }
}

// Déclare les événements de l'app (idempotent). `app` = slug de l'app (requis par
// /register, contrairement à /orgs qui le déduit de la clé). Renvoie un compte-rendu.
export async function registerSupportEvents(app: string): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const res = await hubFetch('/api/notifications/register', {
      app,
      events: [
        {
          slug: SUPPORT_EVENT,
          label: 'Nouveau message support',
          // category ∈ {billing, member, team, shop, system} (sinon l'admin ne l'affiche pas)
          category: 'system',
          // canaux ∈ {email, discord_webhook, discord_dm}
          supported_channels: ['email', 'discord_webhook', 'discord_dm'],
          audiences: ['admin'],
          description: 'Un utilisateur a écrit via le bouton Assistance.',
          default_active: true,
          payload_schema: {
            subject: 'string',
            message: 'string',
            author_email: 'string',
            author_id: 'string',
          },
        },
      ],
    })
    if (!res) return { ok: false, status: 0, body: 'Intégration non configurée' }
    const text = await res.text()
    return { ok: res.ok, status: res.status, body: text }
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e) }
  }
}

// Auto-déclaration des events au démarrage de l'app (instrumentation). Lit le slug
// dans NOTIFICATION_APP. Best-effort : aucune erreur ne remonte, juste un log.
// → plus besoin de visiter une URL pour déclarer les events.
export async function registerAppEvents(): Promise<void> {
  const app = process.env.NOTIFICATION_APP
  if (!app) return
  const res = await registerSupportEvents(app)
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
