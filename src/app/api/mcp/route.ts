import { NextRequest, NextResponse } from 'next/server'
import { handleMCPRequest, handleMCPSSE } from '@/lib/mcp/handler'
import { validateMCPAuth } from '@/lib/mcp/auth'

const MCP_PROTOCOL_VERSION = '2025-06-18'

// Headers CORS pour Claude Web
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
}

// OPTIONS pour CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}

// POST - Recevoir les requêtes JSON-RPC
export async function POST(request: NextRequest) {
  try {
    // Vérifier le header de version du protocole
    const protocolVersion = request.headers.get('MCP-Protocol-Version')
    if (protocolVersion && protocolVersion !== MCP_PROTOCOL_VERSION) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: `Unsupported protocol version. Expected ${MCP_PROTOCOL_VERSION}`,
          },
          id: null,
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // Authentifier l'utilisateur via le token Bearer
    const authResult = await validateMCPAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: authResult.error || 'Authentication required',
          },
          id: null,
        },
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'WWW-Authenticate': 'Bearer realm="Factur-IA MCP"',
          },
        }
      )
    }

    // Parser le body JSON-RPC
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error',
          },
          id: null,
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // Récupérer ou créer un session ID
    const sessionId = request.headers.get('Mcp-Session-Id')

    // Traiter la requête MCP
    const result = await handleMCPRequest(body, authResult.userId!, sessionId)

    return NextResponse.json(result.response, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        ...(result.sessionId ? { 'Mcp-Session-Id': result.sessionId } : {}),
      },
    })
  } catch (error) {
    console.error('[MCP] Error handling request:', error)
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
        },
        id: null,
      },
      { status: 500, headers: corsHeaders }
    )
  }
}

// GET - SSE pour notifications server → client (optionnel pour maintenant)
export async function GET(request: NextRequest) {
  try {
    // Authentifier
    const authResult = await validateMCPAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'WWW-Authenticate': 'Bearer realm="Factur-IA MCP"',
          },
        }
      )
    }

    const sessionId = request.headers.get('Mcp-Session-Id')
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Créer un stream SSE
    const stream = handleMCPSSE(authResult.userId!, sessionId)

    return new NextResponse(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      },
    })
  } catch (error) {
    console.error('[MCP] Error handling SSE:', error)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

// DELETE - Terminer une session
export async function DELETE(request: NextRequest) {
  const sessionId = request.headers.get('Mcp-Session-Id')
  if (sessionId) {
    // On supprimera la session ici quand le session manager sera implémenté
    console.log('[MCP] Session terminated:', sessionId)
  }

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}
