import { NextResponse } from 'next/server'

// OAuth 2.0 Protected Resource Metadata (RFC 9728)
// https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://invoice-project-lime.vercel.app'

  return NextResponse.json(
    {
      resource: `${baseUrl}/api/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp', 'read', 'write'],
      resource_documentation: `${baseUrl}/docs/mcp`,
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
