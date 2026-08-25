import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Pages 100 % publiques et identiques connecté/anonyme : on saute l'appel
// Supabase (getUser réseau) pour un TTFB propre sur les pages SEO.
const STATIC_PUBLIC = new Set(['/', '/robots.txt', '/sitemap.xml', '/opengraph-image'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (STATIC_PUBLIC.has(pathname) || pathname.startsWith('/legal/')) {
    return NextResponse.next()
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
