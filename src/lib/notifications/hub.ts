import { createHmac } from 'crypto'

// Génère un lien d'association ADMIN vers le hub : l'app signe un token localement
// (HMAC-SHA256 avec NOTIFICATION_SIGNING_SECRET) et l'utilisateur est redirigé vers
// {HUB}/api/link-admin?token=… pour réclamer les droits admin de l'org. Doc hub.
function mintLinkToken(payload: Record<string, unknown>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

// URL d'association admin, ou null si l'intégration n'est pas configurée.
export function buildAdminLinkUrl(opts: {
  app: string
  orgId: string
  appUserId: string
  email?: string
}): string | null {
  const base = process.env.NOTIFICATION_HUB_URL
  const secret = process.env.NOTIFICATION_SIGNING_SECRET
  if (!base || !secret) return null
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
  return `${base.replace(/\/$/, '')}/api/link-admin?token=${encodeURIComponent(token)}`
}

// Émission d'événements vers le hub de notification Quatools (hub.quatools.fr).
//   POST {NOTIFICATION_HUB_URL}/api/notifications/emit
//   Authorization: Bearer <NOTIFICATION_API_KEY>
//   body: { event, org_id, recipients[], payload }
// Best-effort + INERTE si l'intégration n'est pas configurée (env absentes) :
// jamais bloquant pour le métier, jamais d'erreur remontée à l'appelant.

export type HubRecipient = {
  app_user_id?: string
  email?: string
  discord_id?: string
  name?: string
}

export async function emitHubEvent(input: {
  event: string
  payload: Record<string, unknown>
  recipients?: HubRecipient[]
  orgId?: string
}): Promise<void> {
  const base = process.env.NOTIFICATION_HUB_URL
  const apiKey = process.env.NOTIFICATION_API_KEY
  // Intégration non configurée → on ne fait rien (silencieux). Seules HUB_URL +
  // API_KEY sont requises : le hub déduit l'org de la clé (org_id optionnel,
  // utile seulement pour une app multi-org type BAAS).
  if (!base || !apiKey) return
  const orgId = input.orgId ?? process.env.NOTIFICATION_ORG_ID

  try {
    const body: Record<string, unknown> = {
      event: input.event,
      recipients: input.recipients ?? [],
      payload: input.payload,
    }
    if (orgId) body.org_id = orgId

    const res = await fetch(`${base.replace(/\/$/, '')}/api/notifications/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[hub] émission en échec', { event: input.event, status: res.status }, await res.text())
    }
  } catch (e) {
    console.error('[hub] émission en échec', { event: input.event }, e)
  }
}
