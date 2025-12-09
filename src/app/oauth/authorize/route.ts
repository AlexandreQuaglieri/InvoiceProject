import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAuthCode, sha256 } from '@/lib/mcp/oauth'

// OAuth 2.1 Authorization Endpoint
// Étape 1: Affiche le formulaire de consentement
// Étape 2: Après login Supabase, redirige avec le code

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

  // Validations de base
  if (!clientId) {
    return errorResponse('invalid_request', 'client_id is required')
  }
  if (!redirectUri) {
    return errorResponse('invalid_request', 'redirect_uri is required')
  }
  if (responseType !== 'code') {
    return errorRedirect(redirectUri, 'unsupported_response_type', 'Only code is supported', state)
  }
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return errorRedirect(redirectUri, 'invalid_request', 'PKCE with S256 is required', state)
  }

  const supabase = await createClient()

  // Vérifier que le client existe
  const { data: client } = await supabase
    .from('mcp_oauth_clients')
    .select('*')
    .eq('client_id', clientId)
    .single()

  if (!client) {
    return errorResponse('invalid_client', 'Client not found')
  }

  // Vérifier redirect_uri
  if (!client.redirect_uris.includes(redirectUri)) {
    return errorResponse('invalid_request', 'redirect_uri not registered')
  }

  // Vérifier si l'utilisateur est connecté
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Rediriger vers la page de login avec les params OAuth
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://invoice-project-lime.vercel.app'
    const loginUrl = new URL('/login', baseUrl)
    loginUrl.searchParams.set('oauth_redirect', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Utilisateur connecté - Générer le code d'autorisation
  const code = generateAuthCode()
  const codeHash = sha256(code)
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
    return errorRedirect(redirectUri, 'server_error', 'Failed to generate authorization code', state)
  }

  // Rediriger avec le code
  const callbackUrl = new URL(redirectUri)
  callbackUrl.searchParams.set('code', code)
  if (state) {
    callbackUrl.searchParams.set('state', state)
  }

  return NextResponse.redirect(callbackUrl)
}

function errorResponse(error: string, description: string) {
  return NextResponse.json(
    { error, error_description: description },
    { status: 400 }
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
