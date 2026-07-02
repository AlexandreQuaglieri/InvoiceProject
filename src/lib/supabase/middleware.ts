import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Routes publiques (pas de redirection)
  // '/mcp' exact : URL officielle du connecteur (réécrite vers /mcp/mcp), les clients
  // MCP n'ont pas de session Supabase — sans ça, ChatGPT reçoit 307 → /login.
  const publicRoutes = ['/', '/login', '/signup', '/forgot-password', '/auth/callback', '/mcp']
  const publicPrefixes = ['/auth/', '/mcp/', '/oauth/', '/.well-known/', '/api/', '/legal/']

  const isPublicRoute =
    publicRoutes.some((route) => pathname === route) ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix))

  if (!user && !isPublicRoute) {
    // Rediriger vers login si non authentifié
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Pages d'entrée : un utilisateur déjà connecté est renvoyé au dashboard.
  // /auth/reset-password est volontairement exclu (session de récupération active).
  const authPages = new Set(['/', '/login', '/signup', '/forgot-password'])
  if (user && authPages.has(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
