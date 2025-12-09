'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: {
    action: string
    data: Record<string, unknown>
  }
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  messages: ConversationMessage[]
  created_at: string
  updated_at: string
}

export async function getConversations(): Promise<Conversation[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching conversations:', error)
    return []
  }

  return data || []
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching conversation:', error)
    return null
  }

  return data
}

export async function createConversation(
  messages: ConversationMessage[],
  title?: string
): Promise<{ success: boolean; conversation?: Conversation; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  // Générer un titre à partir du premier message si non fourni
  const autoTitle = title || (messages[0]?.content.slice(0, 50) + (messages[0]?.content.length > 50 ? '...' : '')) || 'Nouvelle conversation'

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      title: autoTitle,
      messages,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating conversation:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/chat')
  return { success: true, conversation: data }
}

export async function updateConversation(
  id: string,
  messages: ConversationMessage[],
  title?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  const updateData: { messages: ConversationMessage[]; title?: string } = { messages }
  if (title) {
    updateData.title = title
  }

  const { error } = await supabase
    .from('conversations')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating conversation:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/chat')
  return { success: true }
}

export async function deleteConversation(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Non authentifié' }
  }

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting conversation:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/chat')
  return { success: true }
}
