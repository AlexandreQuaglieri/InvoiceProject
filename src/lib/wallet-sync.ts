// Synchronisation automatique des données vers le Data Wallet (Fluid Store).
// Appelé depuis les server actions (création / mise à jour / suppression).
// Best-effort et non bloquant : on ne casse jamais l'action utilisateur si le wallet est indisponible.
const WALLET_URL = process.env.WALLET_URL || ''
const WALLET_API_KEY = process.env.WALLET_API_KEY || ''

async function ingest(body: Record<string, unknown>): Promise<void> {
  if (!WALLET_API_KEY || !WALLET_URL) return
  try {
    const res = await fetch(`${WALLET_URL}/api/v1/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WALLET_API_KEY}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      // best-effort : on ne casse pas l'action utilisateur, mais on trace l'échec
      console.error(`[wallet-sync] ingest ${body.table} a échoué (HTTP ${res.status})`)
    }
  } catch (e) {
    console.error(`[wallet-sync] ingest ${body.table} injoignable`, e)
  }
}

// Crée ou met à jour un enregistrement dans le wallet.
// L'ingestion wallet est idempotente (clé = record.id) -> pas de doublon, gère les updates.
// ownerUserId = propriétaire stable (companies.user_id), pour que la donnée tombe dans le bon namespace.
export async function walletSync(table: string, record: object, ownerUserId?: string | null): Promise<void> {
  const r = record as Record<string, unknown>
  const userId = ownerUserId ?? (r.user_id as string | undefined)
  if (!userId) return
  await ingest({ table, record: { ...r, user_id: userId } })
}

// Retire un enregistrement supprimé du wallet.
export async function walletRemove(table: string, recordId: string, ownerUserId: string): Promise<void> {
  if (!recordId || !ownerUserId) return
  await ingest({ table, op: 'DELETE', record: { id: recordId, user_id: ownerUserId } })
}
