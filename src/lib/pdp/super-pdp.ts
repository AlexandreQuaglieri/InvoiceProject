import type { PdpProvider } from './provider'
import type {
  PdpTransmissionResult,
  PdpLifecycleEvent,
  PdpInboundInvoice,
  PdpB2cTransaction,
  PdpEReporting,
  PdpValidationResult,
} from './types'

// Implémentation Super PDP (Plateforme Agréée API-first, OpenAPI v1.beta).
// Endpoints et auth VALIDÉS en sandbox (juin 2026) :
//   - Hôte unique : https://api.superpdp.tech (l'environnement sandbox/prod est déterminé
//     par les identifiants OAuth de l'application, pas par l'URL).
//   - Auth OAuth 2.0 client_credentials → POST /oauth2/token → jeton Bearer.
//   - API métier sous le préfixe /v1.beta.

type SuperPdpConfig = {
  clientId: string
  clientSecret: string
  // Indicatif : l'environnement réel dépend des identifiants (companies/me renvoie "env").
  sandbox: boolean
}

const BASE = 'https://api.superpdp.tech'
const API = '/v1.beta'

export function createSuperPdpProvider(config: SuperPdpConfig): PdpProvider {
  let cached: { token: string; expiresAt: number } | null = null

  async function getToken(): Promise<string> {
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token

    const res = await fetch(`${BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
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

// Construit le provider Super PDP à partir des variables d'environnement,
// ou null s'il n'est pas configuré (identifiants OAuth absents).
export function superPdpFromEnv(): PdpProvider | null {
  const clientId = process.env.SUPER_PDP_CLIENT_ID
  const clientSecret = process.env.SUPER_PDP_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return createSuperPdpProvider({
    clientId,
    clientSecret,
    sandbox: process.env.SUPER_PDP_SANDBOX !== 'false',
  })
}
