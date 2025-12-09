import { NextResponse } from 'next/server'

// OAuth 2.1 Authorization Server Metadata (RFC8414)
// https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://invoice-project-lime.vercel.app'

  return NextResponse.json(
    {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      scopes_supported: ['mcp', 'read', 'write'],
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      code_challenge_methods_supported: ['S256'],
      service_documentation: `${baseUrl}/docs/mcp`,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  )
}
