'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { QuoteForm, type QuoteFormData } from './quote-form'
import { updateQuote } from '@/actions/quotes'
import { useLiveStoreActions } from '@/lib/realtime'
import type { Client, QuoteWithRelations } from '@/types/database'

interface EditQuoteFormProps {
  quote: QuoteWithRelations
  clients: Client[]
}

export function EditQuoteForm({ quote, clients }: EditQuoteFormProps) {
  const router = useRouter()
  const { upsertQuote } = useLiveStoreActions()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: QuoteFormData) => {
    setIsLoading(true)
    try {
      const result = await updateQuote(quote.id, {
        client_id: data.client_id,
        issue_date: data.issue_date,
        validity_date: data.validity_date,
        notes: data.notes,
        terms: data.terms,
        items: data.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
        })),
      })
      if (result.success) {
        // Write-through : le devis mis à jour entre immédiatement dans le store live.
        if (result.quote) upsertQuote(result.quote)
        toast.success('Devis mis à jour')
        router.push(`/quotes/${quote.id}`)
      } else {
        toast.error(result.error || 'Une erreur est survenue')
      }
    } catch (error) {
      console.error('Mise à jour du devis échouée', error)
      toast.error('Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <QuoteForm
      quote={quote}
      clients={clients}
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  )
}
