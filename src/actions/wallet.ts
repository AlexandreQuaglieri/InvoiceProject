'use server'

import { createClient } from '@/lib/supabase/server'

// Push des données de facturation vers le Data Wallet (Fluid Store), depuis le code serveur.
// Fiable et debuggable (contrairement au webhook pg_net qui ne transmet pas le header Authorization).
const WALLET_URL = process.env.WALLET_URL || 'https://fluid-store-mcp.quaglieri-alexandre.workers.dev'
const WALLET_APP_ID = process.env.WALLET_APP_ID || 'facture-quatools-32cb35'
const WALLET_API_KEY = process.env.WALLET_API_KEY || ''

export type SyncResult = { ok: boolean; count: number; error?: string }

async function pushRecord(table: string, record: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${WALLET_URL}/api/v1/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WALLET_API_KEY}` },
      body: JSON.stringify({ table, record }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Synchronise toutes les factures + clients de l'utilisateur connecté vers son wallet.
// L'ingestion wallet est idempotente (clé = metadata.record_id) -> re-synchroniser ne crée pas de doublon.
export async function syncWallet(): Promise<SyncResult> {
  if (!WALLET_API_KEY) {
    return { ok: false, count: 0, error: "WALLET_API_KEY n'est pas configurée (à ajouter dans les variables d'environnement Vercel)." }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, count: 0, error: 'Session expirée, reconnecte-toi.' }

  const { data: companies } = await supabase.from('companies').select('id').eq('user_id', user.id)
  const companyIds = (companies ?? []).map((c) => c.id)
  if (companyIds.length === 0) return { ok: true, count: 0 }

  const [{ data: invoices }, { data: clients }] = await Promise.all([
    supabase.from('invoices').select('*').in('company_id', companyIds),
    supabase.from('clients').select('*').in('company_id', companyIds),
  ])

  let count = 0
  for (const inv of invoices ?? []) {
    if (await pushRecord('invoices', { ...inv, user_id: user.id })) count += 1
  }
  for (const cli of clients ?? []) {
    if (await pushRecord('clients', { ...cli, user_id: user.id })) count += 1
  }

  return { ok: true, count }
}
