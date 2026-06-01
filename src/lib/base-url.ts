// URL publique de l'application, source unique de vérité.
// Utilisée par tout le flux OAuth (métadonnées, redirections) et le MCP.
// Définir NEXT_PUBLIC_APP_URL sur Vercel (prod + preview) et dans .env.local.
export function getBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }

  // Fallback Vercel (preview/branche) si la variable n'est pas définie.
  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, '')}`
  }

  // Dernier recours : domaine de production connu.
  return 'https://invoice-project-lime.vercel.app'
}
