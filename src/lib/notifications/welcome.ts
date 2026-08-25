// Email de bienvenue — émis une seule fois par compte, au premier passage
// authentifié (callback OAuth/confirmation, ou inscription directe sans
// confirmation). Déduplication par flag `welcome_sent` dans app_metadata,
// posé AVANT l'émission : mieux vaut rater un bienvenue que le doubler.
// Best-effort : aucune erreur ne remonte, jamais bloquant (charte règle 4).
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitHubEvent, ensureOrg, WELCOME_EVENT } from './hub'

const NEW_ACCOUNT_WINDOW_MS = 60 * 60 * 1000

export async function sendWelcomeIfNew(user: User): Promise<void> {
  try {
    if (!process.env.NOTIFICATION_HUB_URL || !process.env.NOTIFICATION_API_KEY) return
    if (!user.email) return

    // Pré-filtre bon marché : ne rien faire pour les connexions de comptes
    // anciens (évite un appel admin à chaque login OAuth).
    const createdMs = Date.parse(user.created_at)
    if (Number.isNaN(createdMs) || Date.now() - createdMs > NEW_ACCOUNT_WINDOW_MS) return
    if (user.app_metadata?.welcome_sent) return

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { welcome_sent: true },
    })
    if (error) {
      console.error('[welcome] pose du flag welcome_sent en échec', error)
      return
    }

    const orgId = await ensureOrg()
    if (!orgId) return
    await emitHubEvent({
      event: WELCOME_EVENT,
      orgId,
      recipients: [{ email: user.email, app_user_id: user.id }],
      payload: { email: user.email },
    })
  } catch (e) {
    console.error('[welcome] émission en échec', e)
  }
}
