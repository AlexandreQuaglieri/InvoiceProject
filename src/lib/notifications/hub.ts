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
  const orgId = input.orgId ?? process.env.NOTIFICATION_ORG_ID
  // Intégration non configurée → on ne fait rien (silencieux).
  if (!base || !apiKey || !orgId) return

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/notifications/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        event: input.event,
        org_id: orgId,
        recipients: input.recipients ?? [],
        payload: input.payload,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[hub] émission en échec', { event: input.event, status: res.status }, await res.text())
    }
  } catch (e) {
    console.error('[hub] émission en échec', { event: input.event }, e)
  }
}
