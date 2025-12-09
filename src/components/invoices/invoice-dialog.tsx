'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Pencil } from 'lucide-react'

import { InvoiceForm } from './invoice-form'
import { createInvoiceAction, updateInvoiceAction } from '@/actions/invoices'
import type { InvoiceFormData } from '@/lib/validations/invoice'
import type { Client, InvoiceWithRelations } from '@/types/database'

interface InvoiceDialogProps {
  invoice?: InvoiceWithRelations
  clients: Client[]
  trigger?: React.ReactNode
}

export function InvoiceDialog({ invoice, clients, trigger }: InvoiceDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: InvoiceFormData) => {
    setIsLoading(true)
    try {
      const result = invoice
        ? await updateInvoiceAction(invoice.id, data)
        : await createInvoiceAction(data)

      if (result.success) {
        toast.success(invoice ? 'Facture mise à jour' : 'Facture créée')
        setOpen(false)
        if (!invoice && result.data) {
          router.push(`/invoices/${result.data.id}`)
        }
      } else {
        toast.error(result.error || 'Une erreur est survenue')
      }
    } catch (error) {
      toast.error('Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  if (clients.length === 0) {
    return (
      <Button disabled>
        <Plus className="mr-2 h-4 w-4" />
        {t('invoices.new')}
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            {invoice ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                {t('common.edit')}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {t('invoices.new')}
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {invoice ? t('common.edit') : t('invoices.new')}
          </DialogTitle>
          <DialogDescription>
            {invoice
              ? 'Modifiez les informations de la facture.'
              : 'Créez une nouvelle facture.'}
          </DialogDescription>
        </DialogHeader>
        <InvoiceForm
          invoice={invoice}
          clients={clients}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  )
}
