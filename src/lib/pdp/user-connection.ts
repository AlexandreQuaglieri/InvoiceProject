import type { createClient } from '@/lib/supabase/server'
import type { PdpProvider } from './provider'
import { createSuperPdpProvider, superPdpFromEnv, refreshAccessToken, type TokenProvider } from './super-pdp'

type Db = Awaited<ReturnType<typeof createClient>>

export type PdpConnection = {
  connected: boolean
  companyName?: string | null
  companyNumber?: string | null
  env?: string | null
  connectedAt?: string | null
}

// État de raccordement PDP de l'utilisateur (pour l'UI Réglages). Résilient : si les
// colonnes pdp_* n'existent pas encore (migration non appliquée), renvoie non connecté.
export async function getPdpConnection(supabase: Db, userId: string): Promise<PdpConnection> {
  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  const row = (data ?? {}) as Record<string, unknown>
  if (!row.pdp_access_token) return { connected: false }
  return {
    connected: true,
    companyName: (row.pdp_company_name as string | null) ?? null,
    companyNumber: (row.pdp_company_number as string | null) ?? null,
    env: (row.pdp_env as string | null) ?? null,
    connectedAt: (row.pdp_connected_at as string | null) ?? null,
  }
}

// Provider Super PDP scopé à la société de l'utilisateur (jeton OAuth délégué).
// Rafraîchit et persiste l'access_token si expiré. null si non raccordé.
export async function superPdpForUser(supabase: Db, userId: string): Promise<PdpProvider | null> {
  const clientId = process.env.SUPER_PDP_CLIENT_ID
  const clientSecret = process.env.SUPER_PDP_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  const row = (data ?? {}) as Record<string, unknown>
  if (!row.pdp_access_token) return null

  // État mutable local (mis à jour au refresh).
  let accessToken = row.pdp_access_token as string
  let refreshToken = (row.pdp_refresh_token as string | null) ?? null
  let expiresAt = row.pdp_token_expires_at ? new Date(row.pdp_token_expires_at as string).getTime() : 0

  const getToken: TokenProvider = async () => {
    if (accessToken && expiresAt > Date.now() + 30_000) return accessToken
    if (!refreshToken) return accessToken // best-effort : on tente avec le jeton courant
    const set = await refreshAccessToken({ clientId, clientSecret, refreshToken })
    accessToken = set.accessToken
    refreshToken = set.refreshToken ?? refreshToken
    expiresAt = Date.now() + set.expiresIn * 1000
    await supabase
      .from('user_settings')
      .update({
        pdp_access_token: accessToken,
        pdp_refresh_token: refreshToken,
        pdp_token_expires_at: new Date(expiresAt).toISOString(),
      })
      .eq('user_id', userId)
    return accessToken
  }

  return createSuperPdpProvider(getToken)
}

// Provider pour une requête : la société de l'utilisateur si raccordée, sinon l'app
// éditeur (variables d'env), sinon null. Permet une bascule multi-tenant sans casser
// le fonctionnement sandbox existant.
export async function superPdpForRequest(supabase: Db, userId: string): Promise<PdpProvider | null> {
  const forUser = await superPdpForUser(supabase, userId)
  if (forUser) return forUser
  return superPdpFromEnv()
}
