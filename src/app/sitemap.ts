import type { MetadataRoute } from 'next'
import { getBaseUrl } from '@/lib/base-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl()
  return [
    {
      url: `${base}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/suis-je-concerne-2026`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/legal/cgu`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/legal/confidentialite`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/legal/mentions-legales`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
