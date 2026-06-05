// Couche services : source de vérité unique de la logique métier, consommée par
// l'assistant IA in-app (api/chat) et le serveur MCP (mcp/[transport]).
export * from './core'
export * from './guides'
export * as clients from './clients'
export * as invoices from './invoices'
export * as quotes from './quotes'
export * as company from './company'
