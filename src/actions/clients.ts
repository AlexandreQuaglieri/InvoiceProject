'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { clientSchema, type ClientFormData } from '@/lib/validations/client'
import { getCompany } from './company'
import type { Client } from '@/types/database'
import { walletSync, walletRemove } from '@/lib/wallet-sync'
import { after } from 'next/server'
import { notifyClientCreated } from '@/lib/notifications/events'

export async function getClients(search?: string): Promise<Client[]> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) return []

  let query = supabase
    .from('clients')
    .select('*')
    .eq('company_id', company.id)
    .order('name', { ascending: true })

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching clients:', error)
    return []
  }

  return data || []
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) return null

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()

  if (error) {
    console.error('Error fetching client:', error)
    return null
  }

  return data
}

export async function createClientAction(
  formData: ClientFormData
): Promise<{ success: boolean; error?: string; data?: Client }> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) {
    return { success: false, error: 'Aucune entreprise configurée' }
  }

  const validation = clientSchema.safeParse(formData)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message }
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      company_id: company.id,
      ...validation.data,
      email: validation.data.email || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating client:', error)
    return { success: false, error: 'Erreur lors de la création du client' }
  }

  if (data) await walletSync('clients', data, company.user_id)
  // Notification (best-effort) : nouveau client créé.
  if (data) after(() => notifyClientCreated(supabase, company.id, data as Client))
  revalidatePath('/clients')
  return { success: true, data }
}

export async function updateClientAction(
  id: string,
  formData: ClientFormData
): Promise<{ success: boolean; error?: string; data?: Client }> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) {
    return { success: false, error: 'Aucune entreprise configurée' }
  }

  const validation = clientSchema.safeParse(formData)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message }
  }

  const { data, error } = await supabase
    .from('clients')
    .update({
      ...validation.data,
      email: validation.data.email || null,
    })
    .eq('id', id)
    .eq('company_id', company.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating client:', error)
    return { success: false, error: 'Erreur lors de la mise à jour du client' }
  }

  if (data) await walletSync('clients', data, company.user_id)
  revalidatePath('/clients')
  return { success: true, data }
}

export async function deleteClientAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const company = await getCompany()
  if (!company) {
    return { success: false, error: 'Aucune entreprise configurée' }
  }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('company_id', company.id)

  if (error) {
    console.error('Error deleting client:', error)
    return { success: false, error: 'Erreur lors de la suppression du client' }
  }

  await walletRemove('clients', id, company.user_id)
  revalidatePath('/clients')
  return { success: true }
}
