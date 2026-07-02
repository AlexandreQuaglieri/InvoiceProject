import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // L'URL du connecteur distribuée aux assistants est /mcp (getMcpConnectorUrl),
  // mais le handler mcp-handler est monté sur /mcp/[transport] : on réécrit
  // /mcp → /mcp/mcp (streamable HTTP) pour que l'URL officielle réponde en direct.
  // Claude passe par le fallback /mcp/sse ; ChatGPT appelle l'URL telle quelle.
  async rewrites() {
    return [{ source: '/mcp', destination: '/mcp/mcp' }]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xffacbscsdyspuvwcstx.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
