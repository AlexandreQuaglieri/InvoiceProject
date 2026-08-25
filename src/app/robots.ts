import type { MetadataRoute } from 'next'
import { getBaseUrl } from '@/lib/base-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Application (données privées, aucune valeur d'indexation)
          '/dashboard',
          '/clients',
          '/invoices',
          '/quotes',
          '/inbox',
          '/e-reporting',
          '/chat',
          '/company',
          '/settings',
          '/onboarding',
          // Technique
          '/api/',
          '/mcp',
          '/oauth/',
          '/auth/',
        ],
      },
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  }
}
