'use client'

// Porte d'entrée du dashboard : état 100 % DÉRIVÉ du store live (charte règle 1).
// - une étape manque → parcours d'onboarding ;
// - tout est fait mais CGU non acceptées → écran de complétion (consent gate),
//   acceptation OPTIMISTE : bascule immédiate, rollback + toast si échec ;
// - sinon → dashboard.
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { OnboardingFlow } from './onboarding-flow'
import { OnboardingCompletion } from './completion'
import { DashboardContent } from '@/components/dashboard/dashboard-content'
import { acceptTerms } from '@/actions/settings'
import { useLiveClients, useLiveCompany, useLiveInvoices } from '@/lib/realtime'

interface DashboardGateProps {
  termsAcceptedAt: string | null
}

export function DashboardGate({ termsAcceptedAt }: DashboardGateProps) {
  const t = useTranslations('onboarding')
  const company = useLiveCompany()
  const clients = useLiveClients()
  const invoices = useLiveInvoices()

  // Acceptation en session (optimiste) — seul state local, non dérivable.
  const [accepted, setAccepted] = useState(false)

  const companyDone = company !== null
  const clientDone = clients.length > 0
  const invoiceDone = invoices.length > 0
  const allDone = companyDone && clientDone && invoiceDone

  const handleAccept = async () => {
    // Optimiste : on bascule sur le dashboard immédiatement, rollback si échec.
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

  if (!allDone) {
    return <OnboardingFlow />
  }

  if (termsAcceptedAt === null && !accepted) {
    return <OnboardingCompletion onAccept={() => void handleAccept()} />
  }

  return <DashboardContent />
}
