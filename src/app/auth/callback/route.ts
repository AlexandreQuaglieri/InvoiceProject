import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { cookies } from 'next/headers'
import { sanitizeRedirect } from '@/lib/auth/redirect'
import { sendWelcomeIfNew } from '@/lib/notifications/welcome'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error_param = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  // Destination interne sanitisée (fix open-redirect) : un chemin relatif ou une
  // URL de même origine uniquement, sinon /dashboard.
  const next = sanitizeRedirect(searchParams.get('next'), origin)

  // Si Supabase renvoie une erreur directement
  if (error_param) {
    console.error('[AUTH CALLBACK] Error from Supabase:', error_param, error_description)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error_param)}&desc=${encodeURIComponent(error_description || '')}`)
  }

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch (e) {
              console.error('[AUTH CALLBACK] Error setting cookies:', e)
            }
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      // Bienvenue au premier passage d'un nouveau compte (déduplication
      // et best-effort dans le helper, hors chemin critique).
      const user = data.session.user
      after(() => sendWelcomeIfNew(user))

      // Redirect OAuth MCP éventuel, sinon destination demandée — les deux
      // sanitisés à la même origine (jamais de redirection externe).
      const dest = sanitizeRedirect(searchParams.get('oauth_redirect'), origin, next)
      return NextResponse.redirect(`${origin}${dest}`)
    }

    console.error('[AUTH CALLBACK] Exchange error:', error?.message, error?.status)
    // Passer l'erreur dans l'URL pour debug
    const errorMsg = error?.message || 'exchange_failed'
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMsg)}`)
  }

  console.error('[AUTH CALLBACK] No code received')
  // Retour à la page login en cas d'erreur
  return NextResponse.redirect(`${origin}/login?error=no_code`)
}
