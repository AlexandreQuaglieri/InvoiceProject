import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error_param = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  const next = searchParams.get('next') ?? '/dashboard'

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
      // Vérifier s'il y a un redirect OAuth MCP
      const oauthRedirect = searchParams.get('oauth_redirect')
      if (oauthRedirect) {
        return NextResponse.redirect(oauthRedirect)
      }

      return NextResponse.redirect(`${origin}${next}`)
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
