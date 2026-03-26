# Guide : Implémenter un serveur MCP Remote avec OAuth 2.1 pour Claude.ai

Ce guide explique comment configurer un serveur MCP (Model Context Protocol) compatible avec Claude.ai, avec isolation des données par utilisateur.

## Prérequis

- Next.js 14+ (App Router)
- Supabase (Auth + Database)
- Déploiement sur Vercel (ou autre hébergeur supportant les fonctions serverless)

## Architecture

```
Claude.ai
    │
    ▼ (OAuth 2.1 + PKCE)
┌─────────────────────────────────────────┐
│  Ton App Next.js                        │
│                                         │
│  /.well-known/oauth-authorization-server│ ◄─ Metadata OAuth
│  /.well-known/oauth-protected-resource  │ ◄─ Metadata ressource
│  /oauth/register                        │ ◄─ Dynamic Client Registration
│  /oauth/authorize                       │ ◄─ Autorisation (login user)
│  /oauth/token                           │ ◄─ Échange code → tokens
│  /mcp/[transport]                       │ ◄─ Endpoint MCP (tools)
└─────────────────────────────────────────┘
    │
    ▼ (Admin client, filtré par user_id)
┌─────────────────────────────────────────┐
│  Supabase                               │
│  - Auth (Google, etc.)                  │
│  - Database (avec RLS)                  │
│  - Tables OAuth (clients, codes, tokens)│
└─────────────────────────────────────────┘
```

## Étape 1 : Installer les dépendances

```bash
npm install mcp-handler @modelcontextprotocol/sdk zod
```

## Étape 2 : Créer les tables OAuth dans Supabase

Exécute cette migration SQL :

```sql
-- Table des clients OAuth (Dynamic Client Registration)
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT UNIQUE NOT NULL,
  client_secret_hash TEXT,
  client_name TEXT NOT NULL DEFAULT 'MCP Client',
  redirect_uris TEXT[] NOT NULL,
  grant_types TEXT[] NOT NULL DEFAULT ARRAY['authorization_code'],
  response_types TEXT[] NOT NULL DEFAULT ARRAY['code'],
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des codes d'autorisation (temporaires)
CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'mcp',
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  resource TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des tokens OAuth
CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash TEXT UNIQUE NOT NULL,
  refresh_token_hash TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scope TEXT NOT NULL DEFAULT 'mcp',
  resource TEXT,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_access ON mcp_oauth_tokens(access_token_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_refresh ON mcp_oauth_tokens(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_hash ON mcp_oauth_codes(code_hash);

-- RLS (les tables OAuth sont gérées par le service role, pas les users)
ALTER TABLE mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Pas de policies = accès uniquement via service role (admin client)
```

## Étape 3 : Créer le client admin Supabase

Crée `src/lib/supabase/admin.ts` :

```typescript
import { createClient } from '@supabase/supabase-js'

// Client admin qui bypass les RLS policies
// UNIQUEMENT pour les opérations serveur sécurisées
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
```

**Important** : Ajoute `SUPABASE_SERVICE_ROLE_KEY` dans tes variables d'environnement (Vercel, .env.local).

## Étape 4 : Créer les helpers OAuth

Crée `src/lib/mcp/oauth.ts` :

```typescript
import crypto from 'crypto'

// Génère un token MCP (access ou refresh)
export function generateMCPToken(prefix: 'mcp_at' | 'mcp_rt' | 'mcp_live' = 'mcp_at'): string {
  const randomPart = crypto.randomBytes(32).toString('base64url')
  return `${prefix}_${randomPart}`
}

// Hash un token pour stockage sécurisé
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Génère un client_id
export function generateClientId(): string {
  return `mcp_client_${crypto.randomBytes(16).toString('hex')}`
}

// Génère un client_secret
export function generateClientSecret(): string {
  return `mcp_secret_${crypto.randomBytes(32).toString('base64url')}`
}

// Aliases pour clarté
export const generateAccessToken = () => generateMCPToken('mcp_at')
export const generateRefreshToken = () => generateMCPToken('mcp_rt')
```

## Étape 5 : Créer les endpoints OAuth

### 5.1 Metadata OAuth Authorization Server

Crée `src/app/.well-known/oauth-authorization-server/route.ts` :

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  return NextResponse.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    scopes_supported: ['mcp'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    service_documentation: `${baseUrl}/docs`,
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
```

### 5.2 Metadata Protected Resource

Crée `src/app/.well-known/oauth-protected-resource/route.ts` :

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  return NextResponse.json({
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    scopes_supported: ['mcp'],
    bearer_methods_supported: ['header'],
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
```

### 5.3 Dynamic Client Registration

Crée `src/app/oauth/register/route.ts` :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateClientId, generateClientSecret, hashToken } from '@/lib/mcp/oauth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      client_name = 'MCP Client',
      redirect_uris,
      grant_types = ['authorization_code'],
      response_types = ['code'],
      token_endpoint_auth_method = 'none',
    } = body

    // Validation
    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return NextResponse.json(
        { error: 'invalid_client_metadata', error_description: 'redirect_uris is required' },
        { status: 400 }
      )
    }

    // Valider les redirect_uris (localhost, HTTPS, ou Claude)
    for (const uri of redirect_uris) {
      try {
        const url = new URL(uri)
        const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
        const isHttps = url.protocol === 'https:'
        const isClaude = uri.includes('claude.ai') || uri.includes('claude.com')

        if (!isLocalhost && !isHttps && !isClaude) {
          return NextResponse.json(
            { error: 'invalid_redirect_uri', error_description: `Invalid redirect_uri: ${uri}` },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'invalid_redirect_uri', error_description: `Invalid URL: ${uri}` },
          { status: 400 }
        )
      }
    }

    // Générer les credentials
    const clientId = generateClientId()
    const clientSecret = token_endpoint_auth_method !== 'none' ? generateClientSecret() : null
    const clientSecretHash = clientSecret ? hashToken(clientSecret) : null

    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    // Sauvegarder
    const supabase = createAdminClient()
    const { error } = await supabase.from('mcp_oauth_clients').insert({
      client_id: clientId,
      client_secret_hash: clientSecretHash,
      client_name,
      redirect_uris,
      grant_types,
      response_types,
      token_endpoint_auth_method,
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      console.error('Error creating OAuth client:', error)
      return NextResponse.json(
        { error: 'server_error', error_description: 'Failed to register client' },
        { status: 500 }
      )
    }

    const response: Record<string, unknown> = {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris,
      grant_types,
      response_types,
      token_endpoint_auth_method,
      client_name,
    }

    if (clientSecret) {
      response.client_secret = clientSecret
      response.client_secret_expires_at = Math.floor(expiresAt.getTime() / 1000)
    }

    return NextResponse.json(response, {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('DCR error:', error)
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Invalid JSON body' },
      { status: 400 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
```

### 5.4 Authorization Endpoint

Crée `src/app/oauth/authorize/route.ts` :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server' // Client avec cookies
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/mcp/oauth'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const clientId = searchParams.get('client_id')
  const redirectUri = searchParams.get('redirect_uri')
  const responseType = searchParams.get('response_type')
  const scope = searchParams.get('scope') || 'mcp'
  const state = searchParams.get('state')
  const codeChallenge = searchParams.get('code_challenge')
  const codeChallengeMethod = searchParams.get('code_challenge_method')
  const resource = searchParams.get('resource')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  // Validations
  if (!clientId) return errorPage('client_id est requis')
  if (!redirectUri) return errorPage('redirect_uri est requis')
  if (responseType !== 'code') {
    return errorRedirect(redirectUri, 'unsupported_response_type', 'Seul code est supporté', state)
  }
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return errorRedirect(redirectUri, 'invalid_request', 'PKCE avec S256 est requis', state)
  }

  // Vérifier le client (avec admin car tables OAuth n'ont pas de RLS policies pour users)
  const adminDb = createAdminClient()
  const { data: client } = await adminDb
    .from('mcp_oauth_clients')
    .select('*')
    .eq('client_id', clientId)
    .single()

  if (!client) return errorPage('Client non trouvé')
  if (!client.redirect_uris.includes(redirectUri)) {
    return errorPage('redirect_uri non autorisé')
  }

  // Vérifier si l'utilisateur est connecté (via cookies Supabase)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Rediriger vers login avec retour OAuth
    const oauthParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: responseType,
      scope,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      ...(state && { state }),
      ...(resource && { resource }),
    })

    const loginUrl = new URL('/login', baseUrl)
    loginUrl.searchParams.set('oauth_redirect', `${baseUrl}/oauth/authorize?${oauthParams.toString()}`)
    return NextResponse.redirect(loginUrl)
  }

  // Générer le code d'autorisation
  const code = crypto.randomBytes(32).toString('hex')
  const codeHash = hashToken(code)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  const { error } = await adminDb.from('mcp_oauth_codes').insert({
    code_hash: codeHash,
    client_id: clientId,
    user_id: user.id,
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    resource,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error('Error saving auth code:', error)
    return errorRedirect(redirectUri, 'server_error', 'Erreur serveur', state)
  }

  // Rediriger avec le code
  const callbackUrl = new URL(redirectUri)
  callbackUrl.searchParams.set('code', code)
  if (state) callbackUrl.searchParams.set('state', state)

  return NextResponse.redirect(callbackUrl)
}

function errorPage(message: string) {
  return new NextResponse(
    `<!DOCTYPE html>
    <html>
    <head><title>Erreur OAuth</title></head>
    <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh;">
      <div style="text-align: center;">
        <h1 style="color: #e11d48;">Erreur d'autorisation</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>`,
    { status: 400, headers: { 'Content-Type': 'text/html' } }
  )
}

function errorRedirect(redirectUri: string, error: string, description: string, state: string | null) {
  const url = new URL(redirectUri)
  url.searchParams.set('error', error)
  url.searchParams.set('error_description', description)
  if (state) url.searchParams.set('state', state)
  return NextResponse.redirect(url)
}
```

### 5.5 Token Endpoint

Crée `src/app/oauth/token/route.ts` :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken, generateAccessToken, generateRefreshToken } from '@/lib/mcp/oauth'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let body: Record<string, string>

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      body = Object.fromEntries(formData.entries()) as Record<string, string>
    } else if (contentType.includes('application/json')) {
      body = await request.json()
    } else {
      return errorResponse('invalid_request', 'Content-Type invalide')
    }

    const grantType = body.grant_type
    const supabase = createAdminClient()

    if (grantType === 'authorization_code') {
      return handleAuthorizationCode(supabase, body)
    } else if (grantType === 'refresh_token') {
      return handleRefreshToken(supabase, body)
    } else {
      return errorResponse('unsupported_grant_type', 'Grant type non supporté')
    }
  } catch (error) {
    console.error('Token endpoint error:', error)
    return errorResponse('server_error', 'Erreur serveur')
  }
}

async function handleAuthorizationCode(
  supabase: ReturnType<typeof createAdminClient>,
  body: Record<string, string>
) {
  const { code, client_id, redirect_uri, code_verifier } = body

  if (!code || !client_id || !redirect_uri || !code_verifier) {
    return errorResponse('invalid_request', 'Paramètres manquants')
  }

  const codeHash = hashToken(code)

  // Récupérer le code
  const { data: authCode, error: codeError } = await supabase
    .from('mcp_oauth_codes')
    .select('*')
    .eq('code_hash', codeHash)
    .eq('client_id', client_id)
    .eq('redirect_uri', redirect_uri)
    .single()

  if (codeError || !authCode) {
    return errorResponse('invalid_grant', 'Code invalide')
  }

  // Vérifier expiration
  if (new Date(authCode.expires_at) < new Date()) {
    await supabase.from('mcp_oauth_codes').delete().eq('id', authCode.id)
    return errorResponse('invalid_grant', 'Code expiré')
  }

  // Vérifier PKCE
  const expectedChallenge = crypto
    .createHash('sha256')
    .update(code_verifier)
    .digest('base64url')

  if (expectedChallenge !== authCode.code_challenge) {
    return errorResponse('invalid_grant', 'code_verifier invalide')
  }

  // Supprimer le code (usage unique)
  await supabase.from('mcp_oauth_codes').delete().eq('id', authCode.id)

  // Générer les tokens
  const accessToken = generateAccessToken()
  const refreshToken = generateRefreshToken()
  const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30j

  const { error: tokenError } = await supabase.from('mcp_oauth_tokens').insert({
    access_token_hash: hashToken(accessToken),
    refresh_token_hash: hashToken(refreshToken),
    client_id,
    user_id: authCode.user_id,
    scope: authCode.scope,
    resource: authCode.resource,
    access_token_expires_at: accessTokenExpiresAt.toISOString(),
    refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
  })

  if (tokenError) {
    console.error('Error saving tokens:', tokenError)
    return errorResponse('server_error', 'Erreur génération tokens')
  }

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: authCode.scope,
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function handleRefreshToken(
  supabase: ReturnType<typeof createAdminClient>,
  body: Record<string, string>
) {
  const { refresh_token, client_id } = body

  if (!refresh_token || !client_id) {
    return errorResponse('invalid_request', 'Paramètres manquants')
  }

  const refreshTokenHash = hashToken(refresh_token)

  const { data: existingToken, error: tokenError } = await supabase
    .from('mcp_oauth_tokens')
    .select('*')
    .eq('refresh_token_hash', refreshTokenHash)
    .eq('client_id', client_id)
    .single()

  if (tokenError || !existingToken) {
    return errorResponse('invalid_grant', 'Refresh token invalide', 401)
  }

  if (new Date(existingToken.refresh_token_expires_at) < new Date()) {
    await supabase.from('mcp_oauth_tokens').delete().eq('id', existingToken.id)
    return errorResponse('invalid_grant', 'Refresh token expiré', 401)
  }

  // Token rotation
  const newAccessToken = generateAccessToken()
  const newRefreshToken = generateRefreshToken()
  const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000)
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await supabase
    .from('mcp_oauth_tokens')
    .update({
      access_token_hash: hashToken(newAccessToken),
      refresh_token_hash: hashToken(newRefreshToken),
      access_token_expires_at: accessTokenExpiresAt.toISOString(),
      refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
    })
    .eq('id', existingToken.id)

  return NextResponse.json({
    access_token: newAccessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: newRefreshToken,
    scope: existingToken.scope,
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

function errorResponse(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
```

## Étape 6 : Créer l'endpoint MCP

Crée `src/app/mcp/[transport]/route.ts` :

```typescript
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/mcp/oauth'

// Définir le handler MCP avec les tools
const handler = createMcpHandler(
  (server) => {
    // Tool exemple : lister des éléments
    server.tool(
      'list_items',
      'Liste les éléments de l\'utilisateur',
      {
        search: z.string().optional().describe('Recherche par nom'),
        limit: z.number().int().min(1).max(100).optional().describe('Limite (défaut: 50)'),
      },
      async ({ search, limit = 50 }, extra) => {
        // Récupérer le user_id depuis le token OAuth
        const userId = extra.authInfo?.extra?.userId as string
        if (!userId) {
          return {
            content: [{ type: 'text', text: 'Erreur: Non authentifié' }],
          }
        }

        // IMPORTANT: Utiliser le client admin pour bypass RLS
        // puis filtrer manuellement par user_id
        const supabase = createAdminClient()

        let query = supabase
          .from('your_table')
          .select('*')
          .eq('user_id', userId) // Filtrer par utilisateur
          .order('created_at', { ascending: false })
          .limit(limit)

        if (search) {
          query = query.ilike('name', `%${search}%`)
        }

        const { data, error } = await query

        if (error) {
          return {
            content: [{ type: 'text', text: `Erreur: ${error.message}` }],
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(data, null, 2),
          }],
        }
      }
    )

    // Ajouter d'autres tools ici...
  },
  {
    capabilities: {
      tools: {},
    },
  },
  {
    basePath: '/mcp',
    maxDuration: 60,
    verboseLogs: true,
  }
)

// Fonction de vérification du token OAuth
const verifyToken = async (
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined

  const supabase = createAdminClient()

  // Vérifier token OAuth (mcp_at_*)
  if (bearerToken.startsWith('mcp_at_')) {
    const tokenHash = hashToken(bearerToken)

    const { data: tokenData, error } = await supabase
      .from('mcp_oauth_tokens')
      .select('*')
      .eq('access_token_hash', tokenHash)
      .single()

    if (error || !tokenData) return undefined

    // Vérifier expiration
    if (new Date(tokenData.access_token_expires_at) < new Date()) {
      return undefined
    }

    return {
      token: bearerToken,
      clientId: tokenData.client_id,
      scopes: [tokenData.scope],
      extra: {
        userId: tokenData.user_id,
      },
    }
  }

  return undefined
}

// Wrapper avec authentification
const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
```

## Étape 7 : Configurer le middleware

Modifie `src/middleware.ts` (ou `src/lib/supabase/middleware.ts`) pour rendre les routes OAuth/MCP publiques :

```typescript
// Routes publiques (pas de vérification auth Supabase)
const publicRoutes = ['/', '/login', '/auth/callback']
const publicPrefixes = ['/auth/', '/mcp/', '/oauth/', '/.well-known/', '/api/']

const isPublicRoute =
  publicRoutes.some((route) => request.nextUrl.pathname === route) ||
  publicPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix))

if (!user && !isPublicRoute) {
  // Rediriger vers login
}
```

## Étape 8 : Configurer la page de login

Dans ta page `/login`, gère le paramètre `oauth_redirect` pour revenir au flux OAuth après connexion :

```typescript
// Dans ton composant Login
const searchParams = useSearchParams()
const oauthRedirect = searchParams.get('oauth_redirect')

// Après login réussi
if (oauthRedirect) {
  window.location.href = oauthRedirect
} else {
  router.push('/dashboard')
}
```

## Étape 9 : Variables d'environnement

Ajoute dans `.env.local` et Vercel :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # IMPORTANT pour le client admin
NEXT_PUBLIC_APP_URL=https://ton-app.vercel.app
```

## Étape 10 : Tester dans Claude.ai

1. Va sur https://claude.ai/settings/integrations
2. Clique "Ajouter un connecteur personnalisé"
3. Entre l'URL : `https://ton-app.vercel.app/mcp`
4. Claude va automatiquement :
   - Découvrir les endpoints via `/.well-known/oauth-authorization-server`
   - S'enregistrer via `/oauth/register`
   - T'authentifier via `/oauth/authorize`
   - Obtenir des tokens via `/oauth/token`
5. Utilise les tools dans une conversation !

## Sécurité

### Ce qui est protégé

| Route | Protection |
|-------|-----------|
| `/.well-known/*` | Public (metadata standard OAuth) |
| `/oauth/register` | Public mais génère seulement des client_id |
| `/oauth/authorize` | Vérifie session Supabase |
| `/oauth/token` | Vérifie PKCE + code valide |
| `/mcp/*` | **Bearer token obligatoire** |

### Bonnes pratiques appliquées

1. **PKCE S256 obligatoire** - Protection contre l'interception
2. **Tokens hashés** - Stockage sécurisé en base
3. **Codes à usage unique** - Supprimés après échange
4. **Token rotation** - Nouveaux tokens à chaque refresh
5. **Expiration courte** - Access: 1h, Refresh: 30j
6. **Isolation par user_id** - Chaque requête filtrée

### Améliorations optionnelles

- Rate limiting sur `/oauth/register`
- Logs d'audit des connexions OAuth
- Révocation de tokens via UI
- Scopes granulaires (read, write, admin)

## Troubleshooting

### "307 Redirect to /login"
→ Les routes `/mcp/`, `/oauth/`, `/.well-known/` ne sont pas dans les routes publiques du middleware.

### "Données vides malgré user_id correct"
→ Tu utilises `createClient()` au lieu de `createAdminClient()` dans les tools MCP. Les cookies Supabase ne sont pas présents dans les requêtes MCP.

### "Code invalide"
→ Le code a expiré (10 min) ou a déjà été utilisé.

### "PKCE invalide"
→ Le `code_verifier` ne correspond pas au `code_challenge` original.
