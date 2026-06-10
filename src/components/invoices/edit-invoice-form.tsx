'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { InvoiceForm } from './invoice-form'
import { updateInvoiceAction } from '@/actions/invoices'
import { useLiveClients, useLiveInvoice, useLiveStoreActions } from '@/lib/realtime'
import type { InvoiceFormData } from '@/lib/validations/invoice'

interface EditInvoiceFormProps {
  invoiceId: string
}

export function EditInvoiceForm({ invoiceId }: EditInvoiceFormProps) {
  const t = useTranslations()
  const router = useRouter()
  const invoice = useLiveInvoice(invoiceId)
  const clients = useLiveClients()
  const { upsertInvoice } = useLiveStoreActions()
  const [isLoading, setIsLoading] = useState(false)

  // Seuls les brouillons sont modifiables : on renvoie vers le détail sinon
  const isEditable = invoice?.status === 'draft'
  useEffect(() => {
    if (invoice && !isEditable) {
      router.replace(`/invoices/${invoiceId}`)
    }
  }, [invoice, isEditable, invoiceId, router])

  if (!invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('invoices.notFound')}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('invoices.notFound')}</CardTitle>
            <CardDescription>{t('invoices.notFoundDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/invoices">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('invoices.backToList')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isEditable) {
    // Redirection en cours vers le détail
    return null
  }

  const handleSubmit = async (data: InvoiceFormData) => {
    setIsLoading(true)
    try {
      const result = await updateInvoiceAction(invoice.id, data)
      if (result.success) {
        // Write-through : le serveur renvoie la ligne complète, on alimente le store live
        if (result.data) {
          upsertInvoice(result.data)
        }
        toast.success('Facture mise à jour')
        router.push(`/invoices/${invoice.id}`)
      } else {
        toast.error(result.error || 'Une erreur est survenue')
      }
    } catch (error) {
      console.error('Mise à jour de la facture échouée', error)
      toast.error('Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/invoices/${invoice.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Modifier {invoice.number}
          </h1>
          <p className="text-muted-foreground">
            Modifiez les informations de la facture.
          </p>
        </div>
      </div>

      <InvoiceForm
        invoice={invoice}
        clients={clients}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  )
}
