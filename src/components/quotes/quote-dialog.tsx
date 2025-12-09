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

import { QuoteForm, type QuoteFormData } from './quote-form'
import { createQuote } from '@/actions/quotes'
import type { Client, QuoteWithRelations } from '@/types/database'

interface QuoteDialogProps {
  quote?: QuoteWithRelations
  clients: Client[]
  trigger?: React.ReactNode
}

export function QuoteDialog({ quote, clients, trigger }: QuoteDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: QuoteFormData) => {
    setIsLoading(true)
    try {
      const result = await createQuote({
        client_id: data.client_id,
        issue_date: data.issue_date,
        validity_date: data.validity_date,
        notes: data.notes,
        terms: data.terms,
        items: data.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
        })),
      })

      if (result.success) {
        toast.success('Devis créé')
        setOpen(false)
        if (result.quote) {
          router.push(`/quotes/${result.quote.id}`)
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
        {t('quotes.new')}
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            {quote ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                {t('common.edit')}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {t('quotes.new')}
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {quote ? t('common.edit') : t('quotes.new')}
          </DialogTitle>
          <DialogDescription>
            {quote
              ? 'Modifiez les informations du devis.'
              : 'Créez un nouveau devis.'}
          </DialogDescription>
        </DialogHeader>
        <QuoteForm
          quote={quote}
          clients={clients}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  )
}
