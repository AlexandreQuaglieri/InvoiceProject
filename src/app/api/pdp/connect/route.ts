import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthorizeUrl } from '@/lib/pdp'

// Domaine public réel de la requête (résout multi-domaines / changement de domaine :
// le redirect_uri suit toujours le domaine sur lequel se trouve l'utilisateur).
function getOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')
  return `${proto}://${host}`
}

// Démarre le flow OAuth : redirige l'utilisateur vers le consentement Super PDP.
export async function GET(request: NextRequest) {
  const clientId = process.env.SUPER_PDP_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'PDP non configurée sur la plateforme.' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const redirectUri = `${getOrigin(request)}/api/pdp/callback`
  const state = crypto.randomUUID()
  const authorizeUrl = buildAuthorizeUrl({ clientId, redirectUri, state })

  const res = NextResponse.redirect(authorizeUrl)
  // state anti-CSRF (vérifié au retour).
  res.cookies.set('pdp_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
