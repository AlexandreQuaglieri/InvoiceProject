// Couche PDP : abstraction de transmission B2B (facturation électronique 2026).
// L'application ne dépend que de l'interface PdpProvider ; l'implémentation concrète
// (Super PDP) est interchangeable.
export * from './types'
export * from './provider'
export * from './super-pdp'
