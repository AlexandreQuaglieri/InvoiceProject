// Couche services : source de vérité unique de la logique métier, consommée par
// l'assistant IA in-app (api/chat), le serveur MCP (mcp/[transport]), les routes
// API e-invoicing et le cron de synchronisation PDP.
export * from './core'
export * from './guides'
export * from './einvoicing'
export * as clients from './clients'
export * as invoices from './invoices'
export * as quotes from './quotes'
export * as company from './company'
