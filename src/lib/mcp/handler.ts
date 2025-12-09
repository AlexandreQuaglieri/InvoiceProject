import { v4 as uuidv4 } from 'uuid'
import { getMCPTools, executeMCPTool } from './tools'
import { sessionManager } from './session-manager'

interface JSONRPCRequest {
  jsonrpc: '2.0'
  id: number | string | null
  method: string
  params?: Record<string, unknown>
}

interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

// Informations sur le serveur
const SERVER_INFO = {
  name: 'factur-ia-mcp',
  version: '1.0.0',
}

// Capacités supportées par le serveur
const SERVER_CAPABILITIES = {
  tools: {
    listChanged: false,
  },
}

export async function handleMCPRequest(
  body: JSONRPCRequest | JSONRPCRequest[],
  userId: string,
  sessionId: string | null
): Promise<{ response: JSONRPCResponse | JSONRPCResponse[]; sessionId: string }> {
  // Gérer les requêtes batch
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((req) => processSingleRequest(req, userId, sessionId))
    )
    const newSessionId = sessionId || responses[0]?.sessionId || uuidv4()
    return {
      response: responses.map((r) => r.response),
      sessionId: newSessionId,
    }
  }

  const result = await processSingleRequest(body, userId, sessionId)
  return result
}

async function processSingleRequest(
  request: JSONRPCRequest,
  userId: string,
  sessionId: string | null
): Promise<{ response: JSONRPCResponse; sessionId: string }> {
  const { id, method, params } = request

  // Valider JSON-RPC 2.0
  if (request.jsonrpc !== '2.0') {
    return {
      response: {
        jsonrpc: '2.0',
        id: id ?? null,
        error: {
          code: -32600,
          message: 'Invalid Request: jsonrpc must be "2.0"',
        },
      },
      sessionId: sessionId || uuidv4(),
    }
  }

  // Créer ou récupérer la session
  let currentSessionId = sessionId
  if (!currentSessionId) {
    const session = sessionManager.createSession(userId)
    currentSessionId = session.id
  } else {
    const session = sessionManager.getSession(currentSessionId)
    if (!session) {
      // Session expirée, en créer une nouvelle
      const newSession = sessionManager.createSession(userId)
      currentSessionId = newSession.id
    } else if (session.userId !== userId) {
      // Session appartient à un autre utilisateur
      return {
        response: {
          jsonrpc: '2.0',
          id: id ?? null,
          error: {
            code: -32000,
            message: 'Session does not belong to this user',
          },
        },
        sessionId: currentSessionId,
      }
    } else {
      sessionManager.updateActivity(currentSessionId)
    }
  }

  try {
    let result: unknown

    switch (method) {
      case 'initialize':
        result = await handleInitialize(params)
        break

      case 'initialized':
        // Notification - pas de réponse requise
        result = {}
        break

      case 'tools/list':
        result = await handleToolsList()
        break

      case 'tools/call':
        result = await handleToolsCall(params, userId)
        break

      case 'ping':
        result = {}
        break

      default:
        return {
          response: {
            jsonrpc: '2.0',
            id: id ?? null,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          },
          sessionId: currentSessionId,
        }
    }

    return {
      response: {
        jsonrpc: '2.0',
        id: id ?? null,
        result,
      },
      sessionId: currentSessionId,
    }
  } catch (error) {
    console.error(`[MCP] Error handling method ${method}:`, error)
    return {
      response: {
        jsonrpc: '2.0',
        id: id ?? null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      },
      sessionId: currentSessionId,
    }
  }
}

async function handleInitialize(params?: Record<string, unknown>) {
  console.log('[MCP] Initialize request:', params)

  return {
    protocolVersion: '2025-06-18',
    serverInfo: SERVER_INFO,
    capabilities: SERVER_CAPABILITIES,
  }
}

async function handleToolsList() {
  const tools = getMCPTools()
  return { tools }
}

async function handleToolsCall(params: Record<string, unknown> | undefined, userId: string) {
  if (!params || !params.name) {
    throw new Error('Missing tool name')
  }

  const toolName = params.name as string
  const toolArgs = (params.arguments || {}) as Record<string, unknown>

  console.log(`[MCP] Calling tool: ${toolName}`, toolArgs)

  const result = await executeMCPTool(toolName, toolArgs, userId)

  return {
    content: [
      {
        type: 'text',
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      },
    ],
  }
}

// SSE Stream pour notifications (placeholder pour maintenant)
export function handleMCPSSE(userId: string, sessionId: string): ReadableStream {
  console.log(`[MCP] SSE connection for user ${userId}, session ${sessionId}`)

  return new ReadableStream({
    start(controller) {
      // Envoyer un heartbeat initial
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)

      // Garder la connexion ouverte avec des pings périodiques
      const interval = setInterval(() => {
        try {
          controller.enqueue(`: ping\n\n`)
        } catch {
          clearInterval(interval)
        }
      }, 30000)

      // Cleanup quand le client se déconnecte
      return () => {
        clearInterval(interval)
      }
    },
  })
}
