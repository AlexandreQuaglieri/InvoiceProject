'use client'

// Porte d'entrée du dashboard.
// - CGU non acceptées → parcours d'onboarding (qui gère lui-même ses 3 étapes
//   ET l'écran de complétion/consentement comme état terminal).
// - CGU acceptées → dashboard.
// L'acceptation des CGU est le SIGNAL UNIQUE de complétion (l'écran de
// complétion n'est atteignable qu'une fois l'entreprise créée — voir FinishBar).
// Acceptation OPTIMISTE : bascule immédiate, rollback + toast si échec.
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { OnboardingFlow } from './onboarding-flow'
import { DashboardContent } from '@/components/dashboard/dashboard-content'
import { acceptTerms } from '@/actions/settings'

interface DashboardGateProps {
  termsAcceptedAt: string | null
  // Raccordement PDP (user_settings.pdp_connected_at), hors store live.
  pdpConnected: boolean
}

export function DashboardGate({ termsAcceptedAt, pdpConnected }: DashboardGateProps) {
  const t = useTranslations('onboarding')

  // Acceptation en session (optimiste) — seul state local, non dérivable.
  const [accepted, setAccepted] = useState(false)

  const handleAccept = async () => {
    setAccepted(true)
    try {
      const result = await acceptTerms()
      if (!result.success) {
        setAccepted(false)
        toast.error(result.error || t('completion.acceptError'))
      }
    } catch (error) {
      console.error('Acceptation des CGU échouée', error)
      setAccepted(false)
      toast.error(t('completion.acceptError'))
    }
  }

  if (termsAcceptedAt !== null || accepted) {
    return <DashboardContent />
  }

  return <OnboardingFlow pdpConnected={pdpConnected} onAccept={() => void handleAccept()} />
}
