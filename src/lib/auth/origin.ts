import { headers } from 'next/headers'

// Origine de la requête courante, dérivée des en-têtes (serveur uniquement).
// Utilisée pour construire les `redirectTo` des emails (reset password, confirmation)
// sans faire confiance à une valeur fournie par le client.
export async function getRequestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
