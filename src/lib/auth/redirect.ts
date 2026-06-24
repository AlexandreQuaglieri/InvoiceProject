// Sanitisation des redirections d'authentification (fix open-redirect).
// Fonction PURE — importable client ET serveur. N'autorise que des destinations
// internes : un chemin relatif `/...` (jamais `//...`) ou une URL absolue de
// MÊME origine. Tout le reste retombe sur le fallback.
export function sanitizeRedirect(
  raw: string | null | undefined,
  origin: string,
  fallback = '/dashboard'
): string {
  if (!raw) return fallback

  // Chemin relatif interne (refuse `//host` et les schémas type `/\evil`).
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) {
    return raw
  }

  // URL absolue : autorisée seulement si elle vise la même origine.
  try {
    const url = new URL(raw)
    if (url.origin === origin) {
      return `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    // raw n'est pas une URL valide → fallback
  }

  return fallback
}
