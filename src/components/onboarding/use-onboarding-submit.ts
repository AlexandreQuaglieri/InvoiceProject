'use client'

// Soumissions client / facture de l'onboarding — mêmes patterns que
// client-dialog / invoice-dialog : action serveur (auth + Zod + service) →
// write-through dans le store live → toast. Realtime réconcilie ensuite,
// et l'avancement d'étape est dérivé du store (aucun state d'étape stocké).
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { createClientAction } from '@/actions/clients'
import { createInvoiceAction } from '@/actions/invoices'
import { useLiveStoreActions } from '@/lib/realtime'
import type { ClientFormData } from '@/lib/validations/client'
import type { InvoiceFormData } from '@/lib/validations/invoice'

export function useOnboardingSubmit() {
  const t = useTranslations('onboarding')
  const { upsertClient, upsertInvoice } = useLiveStoreActions()
  const [isLoading, setIsLoading] = useState(false)

  const submitClient = async (data: ClientFormData) => {
    setIsLoading(true)
    try {
      const result = await createClientAction(data)
      if (result.success) {
        if (result.data) upsertClient(result.data)
        toast.success(t('toasts.clientCreated'))
      } else {
        toast.error(result.error || t('toasts.genericError'))
      }
    } catch (error) {
      console.error('Création du client (onboarding) échouée', error)
      toast.error(t('toasts.genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  const submitInvoice = async (data: InvoiceFormData) => {
    setIsLoading(true)
    try {
      const result = await createInvoiceAction(data)
      if (result.success) {
        if (result.data) upsertInvoice(result.data)
        toast.success(t('toasts.invoiceCreated'))
      } else {
        toast.error(result.error || t('toasts.genericError'))
      }
    } catch (error) {
      console.error('Création de la facture (onboarding) échouée', error)
      toast.error(t('toasts.genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  return { isLoading, submitClient, submitInvoice }
}
