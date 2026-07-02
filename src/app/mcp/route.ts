import { createFacturIaMcpHandler } from '@/lib/mcp/handler'

// URL officielle du connecteur (getMcpConnectorUrl) : streamable HTTP directement
// sur /mcp — c'est ce que ChatGPT appelle tel quel. Claude passe par le fallback
// /mcp/sse, servi par la route /mcp/[transport].
const handler = createFacturIaMcpHandler({
  streamableHttpEndpoint: '/mcp',
  disableSse: true,
})

export { handler as GET, handler as POST, handler as DELETE }
