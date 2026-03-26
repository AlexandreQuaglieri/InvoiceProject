'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Send, CheckCircle, XCircle, FileText, MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { updateQuoteStatus, convertQuoteToInvoice } from '@/actions/quotes'
import type { Quote, QuoteStatus } from '@/types/database'

interface QuoteStatusActionsProps {
  quote: Quote
}

export function QuoteStatusActions({ quote }: QuoteStatusActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'status'
    status: QuoteStatus
    title: string
    description: string
  } | {
    type: 'convert'
    title: string
    description: string
  } | null>(null)

  const handleStatusChange = async (status: QuoteStatus) => {
    setIsLoading(true)
    try {
      const result = await updateQuoteStatus(quote.id, status)
      if (result.success) {
        toast.success('Statut mis à jour')
        router.refresh()
      } else {
        toast.error(result.error || 'Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setIsLoading(false)
      setConfirmAction(null)
    }
  }

  const handleConvert = async () => {
    setIsLoading(true)
    try {
      const result = await convertQuoteToInvoice(quote.id)
      if (result.success && result.invoiceId) {
        toast.success('Devis converti en facture')
        router.push(`/invoices/${result.invoiceId}`)
      } else {
        toast.error(result.error || 'Erreur lors de la conversion')
      }
    } catch {
      toast.error('Erreur lors de la conversion')
    } finally {
      setIsLoading(false)
      setConfirmAction(null)
    }
  }

  const handleConfirm = () => {
    if (!confirmAction) return
    if (confirmAction.type === 'convert') {
      handleConvert()
    } else {
      handleStatusChange(confirmAction.status)
    }
  }

  const alertDialog = (
    <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Chargement...' : 'Confirmer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (quote.status === 'draft') {
    return (
      <>
        <Button
          onClick={() =>
            setConfirmAction({
              type: 'status',
              status: 'sent',
              title: 'Marquer comme envoyé ?',
              description: 'Cette action indique que le devis a été envoyé au client.',
            })
          }
          disabled={isLoading}
        >
          <Send className="mr-2 h-4 w-4" />
          Marquer envoyé
        </Button>
        {alertDialog}
      </>
    )
  }

  if (quote.status === 'sent') {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={isLoading}>
              <MoreHorizontal className="mr-2 h-4 w-4" />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                setConfirmAction({
                  type: 'status',
                  status: 'accepted',
                  title: 'Marquer comme accepté ?',
                  description: 'Le client a accepté ce devis.',
                })
              }
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Marquer comme accepté
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                setConfirmAction({
                  type: 'status',
                  status: 'rejected',
                  title: 'Marquer comme refusé ?',
                  description: 'Le client a refusé ce devis.',
                })
              }
              className="text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Marquer comme refusé
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                setConfirmAction({
                  type: 'status',
                  status: 'expired',
                  title: 'Marquer comme expiré ?',
                  description: 'La date de validité du devis est dépassée.',
                })
              }
            >
              Marquer comme expiré
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {alertDialog}
      </>
    )
  }

  if (quote.status === 'accepted') {
    return (
      <>
        <Button
          onClick={() =>
            setConfirmAction({
              type: 'convert',
              title: 'Convertir en facture ?',
              description: 'Une nouvelle facture sera créée à partir de ce devis. Le devis sera marqué comme converti.',
            })
          }
          disabled={isLoading}
        >
          <FileText className="mr-2 h-4 w-4" />
          Convertir en facture
        </Button>
        {alertDialog}
      </>
    )
  }

  return null
}
