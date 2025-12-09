'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUser } from './auth'
import type { UserSettings, UserSettingsUpdate } from '@/types/database'

export async function getUserSettings(): Promise<UserSettings | null> {
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

      return newSettings
    }

    console.error('Error fetching user settings:', error)
    return null
  }

  return data
}

export async function updateUserSettings(
  updates: Partial<Omit<UserSettingsUpdate, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string; data?: UserSettings }> {
  const supabase = await createClient()

  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  // S'assurer que les paramètres existent
  await getUserSettings()

  const { data, error } = await supabase
    .from('user_settings')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating user settings:', error)
    return { success: false, error: 'Erreur lors de la mise à jour des paramètres' }
  }

  revalidatePath('/settings')
  return { success: true, data }
}

export async function updateClaudeApiKey(
  apiKey: string | null
): Promise<{ success: boolean; error?: string }> {
  const result = await updateUserSettings({
    claude_api_key: apiKey,
  })

  return { success: result.success, error: result.error }
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
