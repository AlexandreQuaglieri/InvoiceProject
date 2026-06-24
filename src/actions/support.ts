'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from './auth'

// Envoi d'un message d'assistance. Persisté en base (support_messages) : rien
// n'est perdu. Le hub de notification relèvera ces messages ultérieurement.
export async function sendSupportMessage(input: {
  subject?: string
  message: string
}): Promise<{ success: boolean; error?: string }> {
  const message = input.message?.trim()
  if (!message || message.length < 2) {
    return { success: false, error: 'Votre message est vide.' }
  }
  if (message.length > 5000) {
    return { success: false, error: 'Message trop long (5000 caractères max).' }
  }

  const supabase = await createClient()
  const user = await getUser()
  if (!user) return { success: false, error: 'Non authentifié' }

  const { error } = await supabase.from('support_messages').insert({
    user_id: user.id,
    email: user.email ?? null,
    subject: input.subject?.trim() || null,
    message,
  })

  if (error) {
    console.error('[support] envoi message en échec', error)
    return { success: false, error: "Impossible d'envoyer le message. Réessayez." }
  }
  return { success: true }
}
