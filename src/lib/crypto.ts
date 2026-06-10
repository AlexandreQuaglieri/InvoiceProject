// Chiffrement des secrets au repos (AES-256-GCM, node:crypto).
// Format stocké : enc:v1:<iv b64>:<ciphertext b64>:<authTag b64>
// - Clé maîtresse : APP_ENCRYPTION_KEY (32 octets en base64), env Vercel + .env.local.
//   ⚠️ Perdre la clé = secrets irrécupérables (les utilisateurs devront les re-saisir).
// - decryptSecret est tolérant au legacy : une valeur non préfixée est renvoyée
//   telle quelle (déploiement sans fenêtre de casse, migration one-shot ensuite).
// - Le préfixe versionné (v1) permet une rotation de clé future.
// Serveur uniquement — ne jamais importer côté client.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const PREFIX = 'enc:v1:'
const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12

function masterKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY manquante (32 octets en base64). Génération : openssl rand -base64 32"
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY invalide : 32 octets en base64 attendus.')
  }
  return key
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX)
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, masterKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${ciphertext.toString('base64')}:${authTag.toString('base64')}`
}

export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored // legacy plaintext toléré

  const parts = stored.slice(PREFIX.length).split(':')
  if (parts.length !== 3) {
    throw new Error('Secret chiffré illisible (format enc:v1 attendu).')
  }
  const [ivB64, ciphertextB64, authTagB64] = parts
  const decipher = createDecipheriv(ALGO, masterKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

// Variante pour colonnes nullables.
export function decryptSecretOrNull(stored: string | null | undefined): string | null {
  if (!stored) return null
  return decryptSecret(stored)
}
