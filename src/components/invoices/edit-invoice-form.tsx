'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { InvoiceForm } from './invoice-form'
import { updateInvoiceAction } from '@/actions/invoices'
import type { InvoiceFormData } from '@/lib/validations/invoice'
import type { Client, InvoiceWithRelations } from '@/types/database'

interface EditInvoiceFormProps {
  invoice: InvoiceWithRelations
  clients: Client[]
}

export function EditInvoiceForm({ invoice, clients }: EditInvoiceFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: InvoiceFormData) => {
    setIsLoading(true)
    try {
      const result = await updateInvoiceAction(invoice.id, data)
      if (result.success) {
        toast.success('Facture mise à jour')
        router.push(`/invoices/${invoice.id}`)
      } else {
        toast.error(result.error || 'Une erreur est survenue')
      }
    } catch (error) {
      toast.error('Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <InvoiceForm
      invoice={invoice}
      clients={clients}
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  )
}
