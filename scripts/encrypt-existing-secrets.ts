// Migration one-shot : chiffre les secrets user_settings encore en clair
// (claude_api_key, chorus_pro_client_secret, chorus_pro_password,
// pdp_access_token, pdp_refresh_token). Idempotent : les valeurs déjà
// préfixées enc:v1: sont ignorées.
//
// Exécution (depuis factur-ia/) : npx tsx scripts/encrypt-existing-secrets.ts
// Requiert .env.local : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_ENCRYPTION_KEY.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { encryptSecret, isEncrypted } from '../src/lib/crypto'

// Charge .env.local sans dépendance dotenv.
function loadEnvLocal() {
  const content = readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim()
    }
  }
}

const SECRET_COLUMNS = [
  'claude_api_key',
  'chorus_pro_client_secret',
  'chorus_pro_password',
  'pdp_access_token',
  'pdp_refresh_token',
] as const

async function main() {
  loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey || !process.env.APP_ENCRYPTION_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et APP_ENCRYPTION_KEY requis dans .env.local')
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: rows, error } = await supabase
    .from('user_settings')
    .select(`id, user_id, ${SECRET_COLUMNS.join(', ')}`)

  if (error) throw new Error(`Lecture user_settings impossible: ${error.message}`)

  let updated = 0
  let skipped = 0

  for (const row of (rows ?? []) as unknown as Array<Record<string, unknown>>) {
    const patch: Record<string, string> = {}
    for (const column of SECRET_COLUMNS) {
      const value = row[column]
      if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
        patch[column] = encryptSecret(value)
      }
    }

    if (Object.keys(patch).length === 0) {
      skipped++
      continue
    }

    const { error: updateError } = await supabase
      .from('user_settings')
      .update(patch)
      .eq('id', row.id as string)

    if (updateError) {
      console.error(`✗ user_settings ${row.id}: ${updateError.message}`)
    } else {
      updated++
      console.log(`✓ user_settings ${row.id}: ${Object.keys(patch).join(', ')} chiffré(s)`)
    }
  }

  console.log(`\nTerminé : ${updated} ligne(s) chiffrée(s), ${skipped} déjà à jour.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
