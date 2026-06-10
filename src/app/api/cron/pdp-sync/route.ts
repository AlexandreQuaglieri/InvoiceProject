import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { superPdpForUser } from '@/lib/pdp'
import {
  resolveCompanyId,
  syncInbound,
  syncInvoiceLifecycle,
  TERMINAL_PDP_CODES,
} from '@/lib/services'

// Cron Vercel (toutes les 6 h, vercel.json) : synchronise pour chaque
// utilisateur raccordé à la PDP (1) les statuts de cycle de vie des factures
// transmises encore ouvertes, (2) les factures entrantes (inbox).
// La PDP n'a pas de webhooks : ce polling est le filet de fraîcheur quand
// personne n'a l'app ouverte. STRICTEMENT superPdpForUser — jamais le fallback
// éditeur (cross-tenant interdit).
export const maxDuration = 300

const MAX_USERS_PER_RUN = 100
const MAX_INVOICES_PER_USER = 25
const USER_CONCURRENCY = 3

type UserSyncResult = {
  userId: string
  inboundSynced: boolean
  invoicesSynced: number
  errors: string[]
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Utilisateurs raccordés à la PDP (jeton OAuth délégué présent).
  const { data: users, error: usersError } = await admin
    .from('user_settings')
    .select('user_id')
    .not('pdp_access_token', 'is', null)
    .limit(MAX_USERS_PER_RUN)

  if (usersError) {
    console.error('[cron pdp-sync] lecture des utilisateurs raccordés en échec', usersError)
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  const userIds = (users ?? []).map((u) => u.user_id as string)
  const results: UserSyncResult[] = []

  // Concurrence bornée : on traite les utilisateurs par petits paquets.
  for (let i = 0; i < userIds.length; i += USER_CONCURRENCY) {
    const batch = userIds.slice(i, i + USER_CONCURRENCY)
    const settled = await Promise.allSettled(batch.map((userId) => syncOneUser(userId)))
    for (const [index, outcome] of settled.entries()) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value)
      } else {
        const userId = batch[index]
        console.error('[cron pdp-sync] échec utilisateur', { userId }, outcome.reason)
        results.push({ userId, inboundSynced: false, invoicesSynced: 0, errors: [String(outcome.reason)] })
      }
    }
  }

  const summary = {
    users: results.length,
    inboundSynced: results.filter((r) => r.inboundSynced).length,
    invoicesSynced: results.reduce((acc, r) => acc + r.invoicesSynced, 0),
    errors: results.flatMap((r) => r.errors.map((e) => ({ userId: r.userId, error: e }))),
  }
  return NextResponse.json(summary)

  async function syncOneUser(userId: string): Promise<UserSyncResult> {
    const result: UserSyncResult = { userId, inboundSynced: false, invoicesSynced: 0, errors: [] }

    const companyId = await resolveCompanyId(admin, userId)
    if (!companyId.ok) {
      result.errors.push(companyId.error)
      return result
    }
    const ctx = { userId, companyId: companyId.data }

    // Jeton délégué de l'utilisateur UNIQUEMENT (pas de fallback env).
    const pdp = await superPdpForUser(admin, userId)
    if (!pdp) {
      result.errors.push('Raccordement PDP introuvable')
      return result
    }

    // 1. Factures entrantes.
    try {
      const inbound = await syncInbound(admin, ctx, pdp)
      if (inbound.ok) result.inboundSynced = true
      else result.errors.push(inbound.error)
    } catch (e) {
      console.error('[cron pdp-sync] sync inbox en échec', { userId }, e)
      result.errors.push(`inbox: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 2. Statuts des factures transmises encore ouvertes (les plus récentes d'abord).
    const { data: invoices } = await admin
      .from('invoices')
      .select('id, pdp_status')
      .eq('company_id', ctx.companyId)
      .not('pdp_deposit_id', 'is', null)
      .order('pdp_transmitted_at', { ascending: false })
      .limit(MAX_INVOICES_PER_USER * 2)

    const open = ((invoices ?? []) as Array<{ id: string; pdp_status: string | null }>)
      .filter((inv) => !inv.pdp_status || !TERMINAL_PDP_CODES.has(inv.pdp_status))
      .slice(0, MAX_INVOICES_PER_USER)

    for (const inv of open) {
      try {
        const sync = await syncInvoiceLifecycle(admin, ctx, pdp, { invoiceId: inv.id })
        if (sync.ok) result.invoicesSynced += 1
        else result.errors.push(`facture ${inv.id}: ${sync.error}`)
      } catch (e) {
        console.error('[cron pdp-sync] sync facture en échec', { userId, invoiceId: inv.id }, e)
        result.errors.push(`facture ${inv.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return result
  }
}
