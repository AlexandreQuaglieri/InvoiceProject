'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUser } from './auth'
import { encryptSecret } from '@/lib/crypto'
import type { UserSettings, UserSettingsUpdate } from '@/types/database'

// Colonnes secrètes : chiffrées au repos, et JAMAIS renvoyées au client
// (les server actions exportées sont appelables par n'importe quel client authentifié).
const SECRET_COLUMNS = [
  'claude_api_key',
  'chorus_pro_client_secret',
  'chorus_pro_password',
  'pdp_access_token',
  'pdp_refresh_token',
] as const

type SecretColumn = (typeof SECRET_COLUMNS)[number]

// Vue « sûre » des paramètres : pas de secrets, des booléens de présence à la place.
export type SafeUserSettings = Omit<UserSettings, SecretColumn> & {
  claude_api_key_set: boolean
  chorus_pro_configured: boolean
}

function toSafe(row: UserSettings): SafeUserSettings {
  const record = { ...row } as Record<string, unknown>
  for (const column of SECRET_COLUMNS) delete record[column]
  return {
    ...(record as Omit<UserSettings, SecretColumn>),
    claude_api_key_set: Boolean(row.claude_api_key),
    chorus_pro_configured: Boolean(row.chorus_pro_client_secret && row.chorus_pro_password),
  }
}

export async function getUserSettings(): Promise<SafeUserSettings | null> {
  const supabase = await createClient()

  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    // Si pas de paramètres, les créer avec les valeurs par défaut
    if (error.code === 'PGRST116') {
      const { data: newSettings, error: createError } = await supabase
        .from('user_settings')
        .insert({
          user_id: user.id,
          invoice_prefix: 'FAC',
          invoice_next_number: 1,
          locale: 'fr',
          theme: 'system',
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating user settings:', createError)
        return null
      }

      return toSafe(newSettings as UserSettings)
    }

    console.error('Error fetching user settings:', error)
    return null
  }

  return toSafe(data as UserSettings)
}

// Colonnes modifiables via la mise à jour générique. Les secrets passent
// EXCLUSIVEMENT par les actions dédiées (updateClaudeApiKey, updateChorusProSettings).
const UPDATABLE_COLUMNS = [
  'invoice_prefix',
  'invoice_next_number',
  'locale',
  'theme',
  'chorus_pro_sandbox',
] as const

type UpdatableColumn = (typeof UPDATABLE_COLUMNS)[number]

export async function updateUserSettings(
  updates: Partial<Pick<UserSettingsUpdate, UpdatableColumn>>
): Promise<{ success: boolean; error?: string; data?: SafeUserSettings }> {
  const supabase = await createClient()

  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  // Whitelist stricte : on ignore toute colonne hors liste (défense en
  // profondeur — le type ne protège pas d'un appel forgé).
  const sanitized: Record<string, unknown> = {}
  for (const column of UPDATABLE_COLUMNS) {
    if (column in updates) sanitized[column] = (updates as Record<string, unknown>)[column]
  }

  if (Object.keys(sanitized).length === 0) {
    return { success: false, error: 'Aucun paramètre modifiable fourni' }
  }

  // S'assurer que les paramètres existent
  await getUserSettings()

  const { data, error } = await supabase
    .from('user_settings')
    .update(sanitized)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating user settings:', error)
    return { success: false, error: 'Erreur lors de la mise à jour des paramètres' }
  }

  revalidatePath('/settings')
  return { success: true, data: toSafe(data as UserSettings) }
}

export async function updateClaudeApiKey(
  apiKey: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  await getUserSettings()

  const { error } = await supabase
    .from('user_settings')
    .update({ claude_api_key: apiKey ? encryptSecret(apiKey) : null })
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating Claude API key:', error)
    return { success: false, error: 'Erreur lors de la mise à jour de la clé API' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export type ChorusProSettingsInput = {
  chorus_pro_client_id: string
  chorus_pro_login: string
  chorus_pro_sandbox: boolean
  // Optionnels : non fournis = inchangés (l'UI affiche des placeholders masqués).
  chorus_pro_client_secret?: string
  chorus_pro_password?: string
}

export async function updateChorusProSettings(
  input: ChorusProSettingsInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  await getUserSettings()

  const payload: Record<string, unknown> = {
    chorus_pro_client_id: input.chorus_pro_client_id,
    chorus_pro_login: input.chorus_pro_login,
    chorus_pro_sandbox: input.chorus_pro_sandbox,
  }
  if (input.chorus_pro_client_secret) {
    payload.chorus_pro_client_secret = encryptSecret(input.chorus_pro_client_secret)
  }
  if (input.chorus_pro_password) {
    payload.chorus_pro_password = encryptSecret(input.chorus_pro_password)
  }

  const { error } = await supabase
    .from('user_settings')
    .update(payload)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating Chorus Pro settings:', error)
    return { success: false, error: 'Erreur lors de la mise à jour des paramètres Chorus Pro' }
  }

  revalidatePath('/settings')
  return { success: true }
}

// Acceptation des CGU / politique de confidentialité (fin d'onboarding).
export async function acceptTerms(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  await getUserSettings()

  const { error } = await supabase
    .from('user_settings')
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (error) {
    console.error('Error accepting terms:', error)
    return { success: false, error: "Erreur lors de l'enregistrement de votre acceptation" }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateInvoiceSettings(
  prefix: string,
  nextNumber: number
): Promise<{ success: boolean; error?: string }> {
  if (!prefix || prefix.length < 1 || prefix.length > 10) {
    return { success: false, error: 'Le préfixe doit faire entre 1 et 10 caractères' }
  }

  if (nextNumber < 1) {
    return { success: false, error: 'Le numéro doit être supérieur à 0' }
  }

  const result = await updateUserSettings({
    invoice_prefix: prefix.toUpperCase(),
    invoice_next_number: nextNumber,
  })

  return { success: result.success, error: result.error }
}
