import type { PdpProvider } from './provider'
import type {
  PdpTransmissionResult,
  PdpLifecycleEvent,
  PdpInboundInvoice,
  PdpB2cTransaction,
  PdpB2cPayment,
  PdpEReporting,
  PdpValidationResult,
} from './types'

// Implémentation Super PDP (Plateforme Agréée API-first, OpenAPI v1.beta).
// Endpoints et auth VALIDÉS en sandbox (juin 2026) :
//   - Hôte unique : https://api.superpdp.tech (l'environnement sandbox/prod est déterminé
//     par les identifiants OAuth de l'application, pas par l'URL).
//   - Auth OAuth 2.0 client_credentials → POST /oauth2/token → jeton Bearer.
//   - API métier sous le préfixe /v1.beta.

const BASE = 'https://api.superpdp.tech'
const API = '/v1.beta'
export const SUPER_PDP_BASE = BASE

// Fournisseur de jeton Bearer — abstrait la stratégie d'auth : `client_credentials`
// côté éditeur (mono-société, fallback), ou `access_token` délégué par utilisateur
// (multi-tenant, OAuth authorization_code).
export type TokenProvider = () => Promise<string>

export function createSuperPdpProvider(getToken: TokenProvider): PdpProvider {
  async function call(path: string, init?: RequestInit): Promise<Response> {
    const token = await getToken()
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    })
    if (!res.ok) {
      throw new Error(`Super PDP ${path} a échoué (${res.status}): ${await res.text()}`)
    }
    return res
  }

  return {
    name: 'Super PDP',

    // POST /v1.beta/invoices avec le PDF Factur-X en corps ; external_id = numéro (idempotence).
    async transmitInvoice(input): Promise<PdpTransmissionResult> {
      const res = await call(
        `${API}/invoices?external_id=${encodeURIComponent(input.invoiceNumber)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: new Uint8Array(input.facturX),
        }
      )
      const data = await res.json()
      return { depositId: String(data.id), transmittedAt: data.created_at }
    },

    // POST /v1.beta/validation_reports (multipart) — validation sans transmission.
    async validateInvoice(input): Promise<PdpValidationResult> {
      const fd = new FormData()
      fd.append(
        'file_name',
        new Blob([new Uint8Array(input.facturX)], { type: 'application/pdf' }),
        input.fileName || 'invoice.pdf'
      )
      const res = await call(`${API}/validation_reports`, { method: 'POST', body: fd })
      const data = await res.json()
      const r = (data.data && data.data[0]) || {}
      const failures: Array<{ validator?: string; message: string }> = []
      for (const sub of (r.subreports ?? []) as Array<Record<string, unknown>>) {
        for (const f of (sub.failures ?? []) as unknown[]) {
          failures.push({
            validator: sub.validator as string | undefined,
            message:
              typeof f === 'string' ? f : ((f as { message?: string })?.message ?? JSON.stringify(f)),
          })
        }
      }
      return {
        isValid: !!r.is_valid,
        format: r.format as string | undefined,
        conformanceLevel: r.conformance_level as string | undefined,
        failures,
      }
    },

    // GET /v1.beta/invoices/{id}/download — fichier brut (Factur-X).
    async downloadInvoice(depositId): Promise<Buffer> {
      const res = await call(`${API}/invoices/${depositId}/download`)
      return Buffer.from(await res.arrayBuffer())
    },

    // GET /v1.beta/invoice_events?invoice_id=...
    async getLifecycle(depositId): Promise<PdpLifecycleEvent[]> {
      const res = await call(`${API}/invoice_events?invoice_id=${encodeURIComponent(depositId)}`)
      const data = await res.json()
      return ((data.data ?? []) as Array<Record<string, unknown>>).map((e) => ({
        depositId,
        statusCode: e.status_code as string,
        statusText: e.status_text as string | undefined,
        occurredAt: e.created_at as string,
        reason: (e.data as { reason?: string } | undefined)?.reason,
      }))
    },

    // POST /v1.beta/invoice_events — pousse un statut (code AFNOR, ex. "fr:208" refusée).
    async pushStatus(depositId, statusCode: string, reason): Promise<void> {
      await call(`${API}/invoice_events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: Number(depositId),
          status_code: statusCode,
          ...(reason ? { details: [{ reason }] } : {}),
        }),
      })
    },

    // GET /v1.beta/invoices?direction=in — factures entrantes (métadonnées).
    async listInbound(): Promise<PdpInboundInvoice[]> {
      const res = await call(`${API}/invoices?direction=in`)
      const data = await res.json()
      return ((data.data ?? []) as Array<Record<string, unknown>>).map((inv) => {
        const en = inv.en_invoice as
          | {
              number?: string
              issue_date?: string
              currency_code?: string
              seller?: { name?: string; trading_name?: string; vat_identifier?: string }
              totals?: { total_with_vat?: string }
            }
          | undefined
        return {
          depositId: String(inv.id),
          externalId: inv.external_id as string | undefined,
          receivedAt: inv.created_at as string,
          number: en?.number,
          sellerName: en?.seller?.name || en?.seller?.trading_name,
          sellerVat: en?.seller?.vat_identifier,
          totalWithVat: en?.totals?.total_with_vat != null ? Number(en.totals.total_with_vat) : undefined,
          currency: en?.currency_code,
          issueDate: en?.issue_date,
        }
      })
    },

    // E-reporting B2C : POST /v1.beta/b2c_transactions (corps { data: [tx] }).
    async reportB2cTransaction(tx: PdpB2cTransaction): Promise<{ id: number }> {
      const res = await call(`${API}/b2c_transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [tx] }),
      })
      const data = await res.json()
      // L'API renvoie "Data" (D majuscule) ; on accepte les deux casses.
      const created = ((data.data ?? data.Data ?? []) as Array<{ id?: number }>)[0]
      return { id: Number(created?.id) }
    },

    // E-reporting des encaissements : POST /v1.beta/b2c_payments (corps { data: [payment] }).
    async reportB2cPayment(payment: PdpB2cPayment): Promise<{ id: number }> {
      const res = await call(`${API}/b2c_payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [payment] }),
      })
      const data = await res.json()
      // Même convention que b2c_transactions : l'API peut renvoyer "Data" (D majuscule).
      const created = ((data.data ?? data.Data ?? []) as Array<{ id?: number }>)[0]
      return { id: Number(created?.id) }
    },

    // GET /v1.beta/ereportings — périodes d'e-reporting.
    async listEReportings(): Promise<PdpEReporting[]> {
      const res = await call(`${API}/ereportings`)
      const data = await res.json()
      return ((data.data ?? []) as Array<Record<string, unknown>>).map((e) => ({
        id: Number(e.id),
        kind: e.kind as 'transaction' | 'payment',
        roleCode: e.role_code as 'SE' | 'BY',
        startPeriod: e.start_period as string,
        endPeriod: e.end_period as string,
      }))
    },
  }
}

// Jeton via OAuth client_credentials (app éditeur) — avec cache mémoire.
function clientCredentialsToken(clientId: string, clientSecret: string): TokenProvider {
  let cached: { token: string; expiresAt: number } | null = null
  return async () => {
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token
    const res = await fetch(`${BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    if (!res.ok) {
      throw new Error(`Super PDP — authentification échouée (${res.status}): ${await res.text()}`)
    }
    const data = await res.json()
    const expiresIn = Number(data.expires_in ?? 1799)
    cached = { token: data.access_token as string, expiresAt: Date.now() + expiresIn * 1000 }
    return cached.token
  }
}

// Provider à partir des variables d'environnement (app éditeur, client_credentials),
// ou null si non configuré. Sert de fallback tant que l'utilisateur n'a pas raccordé
// sa propre société (multi-tenant).
export function superPdpFromEnv(): PdpProvider | null {
  const clientId = process.env.SUPER_PDP_CLIENT_ID
  const clientSecret = process.env.SUPER_PDP_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return createSuperPdpProvider(clientCredentialsToken(clientId, clientSecret))
}

// --- OAuth 2.0 Authorization Code (multi-tenant : délégation par utilisateur) ---
export type OAuthTokenSet = { accessToken: string; refreshToken?: string; expiresIn: number }

// Construit l'URL de consentement où rediriger l'utilisateur.
export function buildAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  scope?: string
}): string {
  const u = new URL(`${BASE}/oauth2/authorize`)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', params.clientId)
  u.searchParams.set('redirect_uri', params.redirectUri)
  u.searchParams.set('state', params.state)
  if (params.scope) u.searchParams.set('scope', params.scope)
  return u.toString()
}

async function oauthToken(body: Record<string, string>): Promise<OAuthTokenSet> {
  const res = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  if (!res.ok) {
    throw new Error(`Super PDP — jeton OAuth échoué (${res.status}): ${await res.text()}`)
  }
  const data = await res.json()
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    expiresIn: Number(data.expires_in ?? 1799),
  }
}

// Échange le code d'autorisation contre des jetons (access + refresh).
export function exchangeAuthCode(params: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
}): Promise<OAuthTokenSet> {
  return oauthToken({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  })
}

// Rafraîchit l'access_token via le refresh_token.
export async function refreshAccessToken(params: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<OAuthTokenSet> {
  const set = await oauthToken({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  })
  return { ...set, refreshToken: set.refreshToken ?? params.refreshToken }
}

// Transforme une erreur brute de la PDP en message lisible pour l'utilisateur.
export function friendlyPdpError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (raw.includes('ne correspond pas au vendeur') || raw.includes('does not match')) {
    return "Le vendeur de la facture ne correspond pas à la société raccordée à la PDP. En test (sandbox), la société raccordée est fictive ; en production, raccordez votre société réelle (même SIRET que sur vos factures)."
  }
  // Récupère le message lisible renvoyé par la PDP ("message":"...").
  const m = raw.match(/"message":"([^"]+)"/)
  return m ? m[1] : error instanceof Error ? error.message : 'Erreur PDP'
}
