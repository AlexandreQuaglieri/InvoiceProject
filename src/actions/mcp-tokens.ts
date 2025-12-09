'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateMCPToken, hashToken } from '@/lib/mcp/auth'

export interface MCPToken {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
}

export async function getMCPTokens(): Promise<MCPToken[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('mcp_api_tokens')
    .select('id, name, created_at, last_used_at, expires_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching MCP tokens:', error)
    return []
  }

  return data || []
}

export async function createMCPToken(
  name: string
): Promise<{ success: boolean; error?: string; token?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  // Vérifier le nombre de tokens existants
  const { data: existingTokens } = await supabase
    .from('mcp_api_tokens')
    .select('id')
    .eq('user_id', user.id)

  if (existingTokens && existingTokens.length >= 5) {
    return { success: false, error: 'Maximum 5 tokens API par utilisateur' }
  }

  // Vérifier que le nom n'existe pas déjà
  const { data: existingName } = await supabase
    .from('mcp_api_tokens')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', name)
    .single()

  if (existingName) {
    return { success: false, error: 'Un token avec ce nom existe déjà' }
  }

  // Générer le token
  const token = generateMCPToken(user.id)
  const tokenHash = hashToken(token)

  // Sauvegarder le hash
  const { error } = await supabase.from('mcp_api_tokens').insert({
    user_id: user.id,
    name,
    token_hash: tokenHash,
    expires_at: null, // Pas d'expiration par défaut
  })

  if (error) {
    console.error('Error creating MCP token:', error)
    return { success: false, error: 'Erreur lors de la création du token' }
  }

  revalidatePath('/settings')

  // Retourner le token en clair (une seule fois !)
  return { success: true, token }
}

export async function deleteMCPToken(
  tokenId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  const { error } = await supabase
    .from('mcp_api_tokens')
    .delete()
    .eq('id', tokenId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting MCP token:', error)
    return { success: false, error: 'Erreur lors de la suppression du token' }
  }

  revalidatePath('/settings')
  return { success: true }
}
