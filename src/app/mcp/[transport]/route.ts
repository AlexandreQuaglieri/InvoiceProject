import { createFacturIaMcpHandler } from '@/lib/mcp/handler'

// Endpoints historiques : /mcp/mcp (streamable HTTP) + /mcp/sse (SSE legacy, Claude).
// L'URL officielle /mcp est servie par la route exacte src/app/mcp/route.ts.
const handler = createFacturIaMcpHandler({ basePath: '/mcp' })

export { handler as GET, handler as POST, handler as DELETE }
