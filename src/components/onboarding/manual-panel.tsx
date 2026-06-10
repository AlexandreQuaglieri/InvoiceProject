'use client'

// Panneau « Manuellement » : embarque le formulaire existant de l'étape.
// CompanyForm gère sa propre soumission (createCompany → setCompany) ;
// client / facture passent par useOnboardingSubmit (pattern des dialogs).
import { useTranslations } from 'next-intl'
import { PenLine } from 'lucide-react'

import { PanelShell } from './panel-shell'
import { useOnboardingSubmit } from './use-onboarding-submit'
import type { OnboardingStep } from './types'
import { CompanyForm } from '@/components/company/company-form'
import { ClientForm } from '@/components/clients/client-form'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { useLiveClients, useLiveCompany } from '@/lib/realtime'

interface ManualPanelProps {
  step: OnboardingStep
  onClose: () => void
}

export function ManualPanel({ step, onClose }: ManualPanelProps) {
  const t = useTranslations('onboarding')
  const company = useLiveCompany()
  const clients = useLiveClients()
  const { isLoading, submitClient, submitInvoice } = useOnboardingSubmit()

  return (
    <PanelShell
      icon={PenLine}
      title={t(`manual.title.${step}`)}
      subtitle={t('manual.subtitle')}
      onClose={onClose}
    >
      {step === 'company' && <CompanyForm company={company} embedded />}
      {step === 'client' && (
        <ClientForm client={null} onSubmit={submitClient} isLoading={isLoading} />
      )}
      {step === 'invoice' && (
        <InvoiceForm clients={clients} onSubmit={submitInvoice} isLoading={isLoading} embedded />
      )}
    </PanelShell>
  )
}
