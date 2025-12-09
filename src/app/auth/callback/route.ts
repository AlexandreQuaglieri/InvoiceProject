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
    console.error('Auth error from Supabase:', error_param, error_description)
    return NextResponse.redirect(`${origin}/login?error=${error_param}`)
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
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('Auth callback exchange error:', error?.message, error?.status)
  }

  // Retour à la page login en cas d'erreur
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
