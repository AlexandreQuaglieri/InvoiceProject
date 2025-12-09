import { NextResponse } from 'next/server'

// Metadata OAuth pour les clients MCP
// Voir: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://invoice-project-lime.vercel.app'

  return NextResponse.json(
    {
      resource: baseUrl,
      bearer_methods_supported: ['header'],
      scopes_supported: ['read', 'write'],
      resource_documentation: `${baseUrl}/docs/mcp`,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}
