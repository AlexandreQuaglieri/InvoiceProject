import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// Hostname du storage Supabase (logos) dérivé de l'instance configurée,
// pour que les images fonctionnent aussi en self-host.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : 'localhost'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Ancien domaine de prod : tout renvoyer vers le domaine canonique.
      // Ne pas rediriger /mcp ni /oauth : les connecteurs MCP enregistrés sur
      // l'ancien host doivent continuer à répondre le temps de leur migration.
      {
        source: '/:path((?!mcp|oauth|\\.well-known).*)',
        has: [{ type: 'host', value: 'invoice-project-lime.vercel.app' }],
        destination: 'https://facturation.quatools.fr/:path',
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHostname,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
