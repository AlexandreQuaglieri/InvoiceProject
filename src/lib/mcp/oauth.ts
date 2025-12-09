import { createHash, randomBytes } from 'crypto'

// ============ TOKENS API LEGACY ============

// Génère un nouveau token API MCP
export function generateMCPToken(userId: string): string {
  const secret = randomBytes(32).toString('base64url')
  return `mcp_live_${userId}_${secret}`
}

// Hash le token pour stockage sécurisé
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ============ OAUTH ============

// Génère un client_id unique
export function generateClientId(): string {
  return `mcp_${randomBytes(16).toString('hex')}`
}

// Génère un client_secret
export function generateClientSecret(): string {
  return randomBytes(32).toString('hex')
}

// Génère un code d'autorisation
export function generateAuthCode(): string {
  return randomBytes(32).toString('hex')
}

// Génère un access token
export function generateAccessToken(): string {
  return `mcp_at_${randomBytes(32).toString('hex')}`
}

// Génère un refresh token
export function generateRefreshToken(): string {
  return `mcp_rt_${randomBytes(32).toString('hex')}`
}

// Hash SHA256
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

// Vérifie le code_challenge PKCE (S256)
export function verifyPKCE(codeVerifier: string, codeChallenge: string): boolean {
  const hash = createHash('sha256').update(codeVerifier).digest('base64url')
  return hash === codeChallenge
}

// Valide une URI de redirection
export function isValidRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri)
    // Accepter localhost (HTTP) ou HTTPS uniquement
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return true
    }
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

// Claude.ai callback URLs autorisées
export const CLAUDE_CALLBACK_URLS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
]

export function isClaudeCallback(uri: string): boolean {
  return CLAUDE_CALLBACK_URLS.some(allowed => uri.startsWith(allowed))
}
