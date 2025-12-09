import {
  protectedResourceHandler,
  metadataCorsOptionsRequestHandler,
} from 'mcp-handler'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://invoice-project-lime.vercel.app'

// OAuth 2.0 Protected Resource Metadata (RFC 9728)
const handler = protectedResourceHandler({
  authServerUrls: [baseUrl],
})

const corsHandler = metadataCorsOptionsRequestHandler()

export { handler as GET, corsHandler as OPTIONS }
