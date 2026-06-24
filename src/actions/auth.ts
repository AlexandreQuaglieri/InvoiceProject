'use server'

import { createClient } from '@/lib/supabase/server'
import { getRequestOrigin } from '@/lib/auth/origin'
import { sanitizeRedirect } from '@/lib/auth/redirect'
import {
  credentialsSchema,
  emailOnlySchema,
  updatePasswordSchema,
  type AuthErrorCode,
  type AuthResult,
} from '@/lib/validations/auth'
import { redirect } from 'next/navigation'

// Server boundary d'authentification : auth provider Supabase + Zod revalidé.
// Toutes les actions renvoient un AuthResult uniforme (charte règle 5). On ne
// laisse jamais fuiter le message brut du provider : on renvoie un code stable
// que le client mappe vers un libellé i18n.

type ProviderError = { code?: string; message?: string; status?: number } | null

function mapAuthError(error: ProviderError): AuthErrorCode {
  const code = error?.code ?? ''
  if (code === 'invalid_credentials' || code === 'invalid_grant') return 'invalid_credentials'
  if (code === 'email_not_confirmed') return 'email_not_confirmed'
  if (code === 'user_already_exists' || code === 'email_exists') return 'email_exists'
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'email_invalid'
  if (code === 'weak_password') return 'weak_password'
  if (code.includes('rate_limit') || code.includes('over_') || error?.status === 429) {
    return 'rate_limited'
  }

  const msg = (error?.message ?? '').toLowerCase()
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'email_exists'
  if (msg.includes('email address') && msg.includes('invalid')) return 'email_invalid'
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) return 'invalid_credentials'
  if (msg.includes('not confirmed')) return 'email_not_confirmed'
  if (msg.includes('rate limit')) return 'rate_limited'
  if (msg.includes('password')) return 'weak_password'
  return 'generic'
}

// Connexion email + mot de passe. Le cookie de session est posé par le client
// serveur Supabase ; le client redirige ensuite vers `redirect`.
export async function signInWithPassword(input: {
  email: string
  password: string
  next?: string
}): Promise<AuthResult> {
  const parsed = credentialsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error) {
    console.error('[auth] signIn', error.code ?? error.message)
    return { ok: false, error: mapAuthError(error) }
  }

  const origin = await getRequestOrigin()
  return { ok: true, redirect: sanitizeRedirect(input.next, origin) }
}

// Inscription email + mot de passe. Selon la config Supabase :
//   - confirmations OFF  → une session est créée immédiatement (redirect) ;
//   - confirmations ON   → pas de session, email de confirmation envoyé.
export async function signUpWithPassword(input: {
  email: string
  password: string
  next?: string
}): Promise<AuthResult> {
  const parsed = credentialsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const origin = await getRequestOrigin()
  const next = sanitizeRedirect(input.next, origin)
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })
  if (error) {
    console.error('[auth] signUp', error.code ?? error.message)
    return { ok: false, error: mapAuthError(error) }
  }

  // Protection contre l'énumération : si l'email existe déjà et que les
  // confirmations sont actives, Supabase renvoie un user sans identités.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, error: 'email_exists' }
  }

  if (data.session) return { ok: true, redirect: next }
  return { ok: true, needsConfirmation: true }
}

// Demande de réinitialisation de mot de passe. Réponse volontairement
// indifférenciée (pas d'énumération d'emails) : on renvoie toujours ok.
export async function requestPasswordReset(input: { email: string }): Promise<AuthResult> {
  const parsed = emailOnlySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const origin = await getRequestOrigin()
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`,
  })
  if (error) {
    // On loggue mais on ne révèle rien à l'appelant.
    console.error('[auth] resetPasswordForEmail', error.code ?? error.message)
  }
  return { ok: true }
}

// Définit un nouveau mot de passe (nécessite une session de récupération posée
// par /auth/callback à l'arrivée du lien email).
export async function updatePassword(input: { password: string }): Promise<AuthResult> {
  const parsed = updatePasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'generic' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    console.error('[auth] updatePassword', error.code ?? error.message)
    return { ok: false, error: mapAuthError(error) }
  }
  return { ok: true, redirect: '/dashboard' }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
