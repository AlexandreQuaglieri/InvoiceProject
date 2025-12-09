import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateClientId, generateClientSecret, hashToken } from '@/lib/mcp/oauth'

// Dynamic Client Registration (RFC 7591)
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

    // Valider les redirect_uris (localhost ou HTTPS ou Claude callback)
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

    // Expiration dans 1 an
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    // Sauvegarder en base
    const supabase = await createClient()
    const { error } = await supabase.from('mcp_oauth_clients').insert({
      client_id: clientId,
      client_secret_hash: clientSecretHash,
      client_name: client_name,
      redirect_uris: redirect_uris,
      grant_types: grant_types,
      response_types: response_types,
      token_endpoint_auth_method: token_endpoint_auth_method,
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      console.error('Error creating OAuth client:', error)
      return NextResponse.json(
        { error: 'server_error', error_description: 'Failed to register client' },
        { status: 500 }
      )
    }

    // Réponse RFC 7591
    const response: Record<string, unknown> = {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirect_uris,
      grant_types: grant_types,
      response_types: response_types,
      token_endpoint_auth_method: token_endpoint_auth_method,
      client_name: client_name,
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
