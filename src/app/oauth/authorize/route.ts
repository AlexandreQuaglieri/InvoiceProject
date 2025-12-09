import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hashToken } from '@/lib/mcp/oauth'
import crypto from 'crypto'

// OAuth 2.1 Authorization Endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const clientId = searchParams.get('client_id')
  const redirectUri = searchParams.get('redirect_uri')
  const responseType = searchParams.get('response_type')
  const scope = searchParams.get('scope') || 'mcp'
  const state = searchParams.get('state')
  const codeChallenge = searchParams.get('code_challenge')
  const codeChallengeMethod = searchParams.get('code_challenge_method')
  const resource = searchParams.get('resource')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://invoice-project-lime.vercel.app'

  // Validations
  if (!clientId) {
    return errorPage('client_id est requis')
  }
  if (!redirectUri) {
    return errorPage('redirect_uri est requis')
  }
  if (responseType !== 'code') {
    return errorRedirect(redirectUri, 'unsupported_response_type', 'Seul code est supporté', state)
  }
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return errorRedirect(redirectUri, 'invalid_request', 'PKCE avec S256 est requis', state)
  }

  const supabase = await createClient()

  // Vérifier que le client existe
  const { data: client } = await supabase
    .from('mcp_oauth_clients')
    .select('*')
    .eq('client_id', clientId)
    .single()

  if (!client) {
    return errorPage('Client non trouvé')
  }

  // Vérifier redirect_uri
  if (!client.redirect_uris.includes(redirectUri)) {
    return errorPage('redirect_uri non autorisé')
  }

  // Vérifier si l'utilisateur est connecté
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Stocker les params OAuth en session et rediriger vers login
    const oauthParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: responseType,
      scope,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      ...(state && { state }),
      ...(resource && { resource }),
    })

    const loginUrl = new URL('/login', baseUrl)
    loginUrl.searchParams.set('oauth_redirect', `${baseUrl}/oauth/authorize?${oauthParams.toString()}`)

    return NextResponse.redirect(loginUrl)
  }

  // Utilisateur connecté - Générer le code d'autorisation
  const code = crypto.randomBytes(32).toString('hex')
  const codeHash = hashToken(code)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  // Sauvegarder le code
  const { error } = await supabase.from('mcp_oauth_codes').insert({
    code_hash: codeHash,
    client_id: clientId,
    user_id: user.id,
    redirect_uri: redirectUri,
    scope: scope,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    resource: resource,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error('Error saving auth code:', error)
    return errorRedirect(redirectUri, 'server_error', 'Erreur serveur', state)
  }

  // Rediriger avec le code
  const callbackUrl = new URL(redirectUri)
  callbackUrl.searchParams.set('code', code)
  if (state) {
    callbackUrl.searchParams.set('state', state)
  }

  return NextResponse.redirect(callbackUrl)
}

function errorPage(message: string) {
  return new NextResponse(
    `<!DOCTYPE html>
    <html>
    <head><title>Erreur OAuth</title></head>
    <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
      <div style="text-align: center;">
        <h1 style="color: #e11d48;">Erreur d'autorisation</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>`,
    {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    }
  )
}

function errorRedirect(redirectUri: string, error: string, description: string, state: string | null) {
  const url = new URL(redirectUri)
  url.searchParams.set('error', error)
  url.searchParams.set('error_description', description)
  if (state) {
    url.searchParams.set('state', state)
  }
  return NextResponse.redirect(url)
}
