import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateAccessToken,
  generateRefreshToken,
  sha256,
  verifyPKCE,
} from '@/lib/mcp/oauth'

// OAuth 2.1 Token Endpoint
// Échange code -> access_token ou refresh_token -> access_token

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
      return errorResponse('invalid_request', 'Content-Type must be application/x-www-form-urlencoded or application/json')
    }

    const grantType = body.grant_type
    const supabase = await createClient()

    if (grantType === 'authorization_code') {
      return handleAuthorizationCode(supabase, body)
    } else if (grantType === 'refresh_token') {
      return handleRefreshToken(supabase, body)
    } else {
      return errorResponse('unsupported_grant_type', 'Only authorization_code and refresh_token are supported')
    }
  } catch (error) {
    console.error('Token endpoint error:', error)
    return errorResponse('server_error', 'Internal server error')
  }
}

async function handleAuthorizationCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  body: Record<string, string>
) {
  const { code, client_id, redirect_uri, code_verifier } = body

  if (!code || !client_id || !redirect_uri || !code_verifier) {
    return errorResponse('invalid_request', 'Missing required parameters: code, client_id, redirect_uri, code_verifier')
  }

  const codeHash = sha256(code)

  // Récupérer le code d'autorisation
  const { data: authCode, error: codeError } = await supabase
    .from('mcp_oauth_codes')
    .select('*')
    .eq('code_hash', codeHash)
    .eq('client_id', client_id)
    .eq('redirect_uri', redirect_uri)
    .single()

  if (codeError || !authCode) {
    return errorResponse('invalid_grant', 'Invalid authorization code')
  }

  // Vérifier expiration
  if (new Date(authCode.expires_at) < new Date()) {
    await supabase.from('mcp_oauth_codes').delete().eq('id', authCode.id)
    return errorResponse('invalid_grant', 'Authorization code expired')
  }

  // Vérifier PKCE
  if (!verifyPKCE(code_verifier, authCode.code_challenge)) {
    return errorResponse('invalid_grant', 'Invalid code_verifier')
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
    access_token_hash: sha256(accessToken),
    refresh_token_hash: sha256(refreshToken),
    client_id: client_id,
    user_id: authCode.user_id,
    scope: authCode.scope,
    resource: authCode.resource,
    access_token_expires_at: accessTokenExpiresAt.toISOString(),
    refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
  })

  if (tokenError) {
    console.error('Error saving tokens:', tokenError)
    return errorResponse('server_error', 'Failed to generate tokens')
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
      },
    }
  )
}

async function handleRefreshToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  body: Record<string, string>
) {
  const { refresh_token, client_id } = body

  if (!refresh_token || !client_id) {
    return errorResponse('invalid_request', 'Missing required parameters: refresh_token, client_id')
  }

  const refreshTokenHash = sha256(refresh_token)

  // Récupérer le token
  const { data: existingToken, error: tokenError } = await supabase
    .from('mcp_oauth_tokens')
    .select('*')
    .eq('refresh_token_hash', refreshTokenHash)
    .eq('client_id', client_id)
    .single()

  if (tokenError || !existingToken) {
    return errorResponse('invalid_grant', 'Invalid refresh token', 401)
  }

  // Vérifier expiration
  if (new Date(existingToken.refresh_token_expires_at) < new Date()) {
    await supabase.from('mcp_oauth_tokens').delete().eq('id', existingToken.id)
    return errorResponse('invalid_grant', 'Refresh token expired', 401)
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
      access_token_hash: sha256(newAccessToken),
      refresh_token_hash: sha256(newRefreshToken),
      access_token_expires_at: accessTokenExpiresAt.toISOString(),
      refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
    })
    .eq('id', existingToken.id)

  if (updateError) {
    console.error('Error updating tokens:', updateError)
    return errorResponse('server_error', 'Failed to refresh tokens')
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
      },
    }
  )
}

// CORS preflight
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
