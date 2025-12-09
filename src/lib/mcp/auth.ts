import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

interface AuthResult {
  success: boolean
  userId?: string
  error?: string
}

/**
 * Valide l'authentification MCP via Bearer token
 * Format du token: mcp_live_{base64(userId:secret)}
 */
export async function validateMCPAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader) {
    return { success: false, error: 'Authorization header required' }
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Bearer token required' }
  }

  const token = authHeader.slice(7) // Enlever "Bearer "

  // Vérifier le format du token
  if (!token.startsWith('mcp_live_')) {
    return { success: false, error: 'Invalid token format' }
  }

  try {
    const supabase = await createClient()

    // Chercher le token dans la base de données
    const tokenHash = hashToken(token)

    const { data: tokenRecord, error } = await supabase
      .from('mcp_api_tokens')
      .select('user_id, expires_at')
      .eq('token_hash', tokenHash)
      .single()

    if (error || !tokenRecord) {
      console.log('[MCP Auth] Token not found:', error?.message)
      return { success: false, error: 'Invalid token' }
    }

    // Vérifier l'expiration
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return { success: false, error: 'Token expired' }
    }

    // Mettre à jour last_used_at
    await supabase
      .from('mcp_api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)

    console.log('[MCP Auth] Token validated for user:', tokenRecord.user_id)

    return { success: true, userId: tokenRecord.user_id }
  } catch (error) {
    console.error('[MCP Auth] Error validating token:', error)
    return { success: false, error: 'Authentication failed' }
  }
}

/**
 * Génère un nouveau token API MCP
 */
export function generateMCPToken(userId: string): string {
  const secret = crypto.randomBytes(32).toString('base64url')
  return `mcp_live_${userId}_${secret}`
}

/**
 * Hash le token pour stockage sécurisé
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Extrait le userId d'un token (pour affichage partiel)
 */
export function extractUserIdFromToken(token: string): string | null {
  if (!token.startsWith('mcp_live_')) {
    return null
  }

  const parts = token.slice(9).split('_')
  if (parts.length >= 1) {
    return parts[0]
  }

  return null
}
