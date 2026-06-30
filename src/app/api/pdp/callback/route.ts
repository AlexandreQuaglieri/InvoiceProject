import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptSecret } from '@/lib/crypto'
import { exchangeAuthCode, SUPER_PDP_BASE } from '@/lib/pdp'
import { notifyPdpConnected } from '@/lib/notifications/events'

function getOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')
  return `${proto}://${host}`
}

// Retour du consentement Super PDP : échange le code, récupère la société, stocke les jetons.
export async function GET(request: NextRequest) {
  const origin = getOrigin(request)
  // `reason` rend l'échec diagnostiquable depuis l'URL (config | state | exchange).
  const settings = (status: string, reason?: string) =>
    NextResponse.redirect(
      `${origin}/settings?tab=einvoicing&pdp=${status}${reason ? `&reason=${reason}` : ''}`
    )

  const clientId = process.env.SUPER_PDP_CLIENT_ID
  const clientSecret = process.env.SUPER_PDP_CLIENT_SECRET
  if (!clientId || !clientSecret) return settings('error', 'config')

  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = request.cookies.get('pdp_oauth_state')?.value
  if (!code || !state || !cookieState || state !== cookieState) {
    // Cause typique : cookie de state expiré (consentement Super PDP trop long)
    // ou domaine de retour différent de celui qui a posé le cookie.
    console.error('[pdp/callback] state CSRF invalide', {
      hasCode: !!code,
      hasState: !!state,
      hasCookie: !!cookieState,
      match: state === cookieState,
    })
    return settings('error', 'state')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  try {
    const redirectUri = `${origin}/api/pdp/callback`
    const tokens = await exchangeAuthCode({ clientId, clientSecret, code, redirectUri })

    // Récupère la société raccordée (pour l'afficher).
    let company: Record<string, unknown> = {}
    try {
      const meRes = await fetch(`${SUPER_PDP_BASE}/v1.beta/companies/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })
      if (meRes.ok) company = await meRes.json()
    } catch (e) {
      // non bloquant : la connexion PDP reste valide sans les infos société
      console.error('[pdp/callback] récupération de la société (companies/me) en échec', e)
    }

    const payload = {
      pdp_access_token: encryptSecret(tokens.accessToken),
      pdp_refresh_token: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      pdp_token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      pdp_company_number: (company.number as string | undefined) ?? null,
      pdp_company_name:
        (company.formal_name as string | undefined) || (company.trade_name as string | undefined) || null,
      pdp_env: (company.env as string | undefined) ?? null,
      pdp_connected_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      await supabase.from('user_settings').update(payload).eq('user_id', user.id)
    } else {
      await supabase.from('user_settings').insert({ user_id: user.id, ...payload })
    }

    // Notification best-effort : la PDP est raccordée.
    const { data: comp } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (comp) {
      const companyId = (comp as { id: string }).id
      after(() =>
        notifyPdpConnected(supabase, companyId, {
          companyName: payload.pdp_company_name,
          companyNumber: payload.pdp_company_number,
          env: payload.pdp_env,
        })
      )
    }

    const res = settings('connected')
    res.cookies.delete('pdp_oauth_state')
    return res
  } catch (e) {
    console.error('[pdp/callback] échange du code OAuth en échec', { userId: user.id }, e)
    return settings('error', 'exchange')
  }
}
