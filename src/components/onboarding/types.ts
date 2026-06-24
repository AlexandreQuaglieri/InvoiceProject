// Types partagés du parcours d'onboarding. Les étapes sont 100 % dérivées
// (charte règle 1) : entreprise ✓ === useLiveCompany() !== null ; facture
// électronique ✓ === raccordement PDP (user_settings.pdp_connected_at) ;
// premier client ✓ === useLiveClients().length > 0.
export type OnboardingStep = 'company' | 'einvoicing' | 'client'

// Étapes guidées par l'IA (extraction d'un document : kind = step côté API).
export type ExtractStep = 'company' | 'client'

export const ONBOARDING_STEPS: readonly OnboardingStep[] = ['company', 'einvoicing', 'client']
