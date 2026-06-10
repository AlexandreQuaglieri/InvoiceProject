// URL publique de l'application, source unique de vérité.
// Utilisée par tout le flux OAuth (métadonnées, redirections) et le MCP.
//
// IMPORTANT : ne JAMAIS utiliser process.env.VERCEL_URL ici. Cette variable
// contient l'URL ÉPHÉMÈRE propre à chaque déploiement (ex: invoice-project-xxx.vercel.app),
// pas le domaine stable du connecteur. L'utiliser casse l'enregistrement OAuth de Claude.ai
// (issuer / registration_endpoint pointant vers un host qui change à chaque déploiement).
//
// Pour pointer vers un autre domaine, définir NEXT_PUBLIC_APP_URL sur Vercel (prod + preview).
export function getBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }

  // Domaine de production stable (comportement historique).
  return 'https://invoice-project-lime.vercel.app'
}

// URL du connecteur MCP à coller dans Claude.ai / ChatGPT — source unique
// (le handler vit sur /mcp, cf. src/app/mcp/[transport]/route.ts, basePath '/mcp').
export function getMcpConnectorUrl(): string {
  return `${getBaseUrl()}/mcp`
}
