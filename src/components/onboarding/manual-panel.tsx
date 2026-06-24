'use client'

// Panneau « Remplir à la main » : repli du chemin IA. Embarque le formulaire
// existant de l'étape. CompanyForm gère sa propre soumission (createCompany →
// setCompany) ; le client passe par useOnboardingSubmit (pattern des dialogs).
import { useTranslations } from 'next-intl'
import { PenLine } from 'lucide-react'

import { PanelShell } from './panel-shell'
import { useOnboardingSubmit } from './use-onboarding-submit'
import type { ExtractStep } from './types'
import { CompanyForm } from '@/components/company/company-form'
import { ClientForm } from '@/components/clients/client-form'
import { useLiveCompany } from '@/lib/realtime'

interface ManualPanelProps {
  step: ExtractStep
  // « Revenir à l'IA » : referme le repli manuel.
  onClose: () => void
}

export function ManualPanel({ step, onClose }: ManualPanelProps) {
  const t = useTranslations('onboarding')
  const company = useLiveCompany()
  const { isLoading, submitClient } = useOnboardingSubmit()

  return (
    <PanelShell
      icon={PenLine}
      title={t(`manual.title.${step}`)}
      subtitle={t('manual.subtitle')}
      onClose={onClose}
    >
      {step === 'company' && <CompanyForm company={company} embedded />}
      {step === 'client' && <ClientForm client={null} onSubmit={submitClient} isLoading={isLoading} />}
    </PanelShell>
  )
}
