import {
  protectedResourceHandler,
  metadataCorsOptionsRequestHandler,
} from 'mcp-handler'
import { getBaseUrl } from '@/lib/base-url'

const baseUrl = getBaseUrl()

// OAuth 2.0 Protected Resource Metadata (RFC 9728)
const handler = protectedResourceHandler({
  authServerUrls: [baseUrl],
})

const corsHandler = metadataCorsOptionsRequestHandler()

export { handler as GET, corsHandler as OPTIONS }
