import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken, generateAccessToken, generateRefreshToken } from '@/lib/mcp/oauth'
import crypto from 'crypto'

// OAuth 2.1 Token Endpoint
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
      return errorResponse('invalid_request', 'Content-Type doit être application/x-www-form-urlencoded ou application/json')
    }

    const grantType = body.grant_type
    const supabase = createAdminClient()

    if (grantType === 'authorization_code') {
      return handleAuthorizationCode(supabase, body)
    } else if (grantType === 'refresh_token') {
      return handleRefreshToken(supabase, body)
    } else {
      return errorResponse('unsupported_grant_type', 'Seuls authorization_code et refresh_token sont supportés')
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
    return errorResponse('invalid_request', 'Paramètres manquants: code, client_id, redirect_uri, code_verifier')
  }

  const codeHash = hashToken(code)

  // Récupérer le code d'autorisation
  const { data: authCode, error: codeError } = await supabase
    .from('mcp_oauth_codes')
    .select('*')
    .eq('code_hash', codeHash)
    .eq('client_id', client_id)
    .eq('redirect_uri', redirect_uri)
    .single()

  if (codeError || !authCode) {
    return errorResponse('invalid_grant', 'Code d\'autorisation invalide')
  }

  // Vérifier expiration
  if (new Date(authCode.expires_at) < new Date()) {
    await supabase.from('mcp_oauth_codes').delete().eq('id', authCode.id)
    return errorResponse('invalid_grant', 'Code d\'autorisation expiré')
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
  const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 heure
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours

  // Sauvegarder les tokens
  const { error: tokenError } = await supabase.from('mcp_oauth_tokens').insert({
    access_token_hash: hashToken(accessToken),
    refresh_token_hash: hashToken(refreshToken),
    client_id: client_id,
    user_id: authCode.user_id,
    scope: authCode.scope,
    resource: authCode.resource,
    access_token_expires_at: accessTokenExpiresAt.toISOString(),
    refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
  })

  if (tokenError) {
    console.error('Error saving tokens:', tokenError)
    return errorResponse('server_error', 'Erreur lors de la génération des tokens')
  }

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: authCode.scope,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}

async function handleRefreshToken(
  supabase: ReturnType<typeof createAdminClient>,
  body: Record<string, string>
) {
  const { refresh_token, client_id } = body

  if (!refresh_token || !client_id) {
    return errorResponse('invalid_request', 'Paramètres manquants: refresh_token, client_id')
  }

  const refreshTokenHash = hashToken(refresh_token)

  // Récupérer le token
  const { data: existingToken, error: tokenError } = await supabase
    .from('mcp_oauth_tokens')
    .select('*')
    .eq('refresh_token_hash', refreshTokenHash)
    .eq('client_id', client_id)
    .single()

  if (tokenError || !existingToken) {
    return errorResponse('invalid_grant', 'Refresh token invalide', 401)
  }

  // Vérifier expiration
  if (new Date(existingToken.refresh_token_expires_at) < new Date()) {
    await supabase.from('mcp_oauth_tokens').delete().eq('id', existingToken.id)
    return errorResponse('invalid_grant', 'Refresh token expiré', 401)
  }

  // Rotation: générer nouveaux tokens
  const newAccessToken = generateAccessToken()
  const newRefreshToken = generateRefreshToken()
  const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000)
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // Mettre à jour
  const { error: updateError } = await supabase
    .from('mcp_oauth_tokens')
    .update({
      access_token_hash: hashToken(newAccessToken),
      refresh_token_hash: hashToken(newRefreshToken),
      access_token_expires_at: accessTokenExpiresAt.toISOString(),
      refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
    })
    .eq('id', existingToken.id)

  if (updateError) {
    console.error('Error updating tokens:', updateError)
    return errorResponse('server_error', 'Erreur lors du refresh')
  }

  return NextResponse.json(
    {
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: existingToken.scope,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
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
