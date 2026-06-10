// Types partagés du parcours d'onboarding. Les étapes sont 100 % dérivées du
// store live (charte règle 1) : company ✓ === useLiveCompany() !== null, etc.
export type OnboardingStep = 'company' | 'client' | 'invoice'

export type OnboardingMethod = 'ai' | 'mcp' | 'manual'

export const ONBOARDING_STEPS: readonly OnboardingStep[] = ['company', 'client', 'invoice']
