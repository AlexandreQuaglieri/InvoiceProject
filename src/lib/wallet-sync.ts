// Synchronisation automatique des données vers le Data Wallet (Fluid Store).
// Appelé depuis les server actions (création / mise à jour / suppression).
// Best-effort et non bloquant : on ne casse jamais l'action utilisateur si le wallet est indisponible.
const WALLET_URL = process.env.WALLET_URL || 'https://fluid-store-mcp.quaglieri-alexandre.workers.dev'
const WALLET_API_KEY = process.env.WALLET_API_KEY || ''

async function ingest(body: Record<string, unknown>): Promise<void> {
  if (!WALLET_API_KEY) return
  try {
    await fetch(`${WALLET_URL}/api/v1/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WALLET_API_KEY}` },
      body: JSON.stringify(body),
    })
  } catch {
    // best-effort : silencieux
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
