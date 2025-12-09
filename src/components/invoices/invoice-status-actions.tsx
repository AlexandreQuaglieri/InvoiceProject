'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Send, CheckCircle, XCircle, MoreHorizontal } from 'lucide-react'

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

import { updateInvoiceStatusAction } from '@/actions/invoices'
import type { Invoice, InvoiceStatus } from '@/types/database'

interface InvoiceStatusActionsProps {
  invoice: Invoice
}

export function InvoiceStatusActions({ invoice }: InvoiceStatusActionsProps) {
  const t = useTranslations()
  const [isLoading, setIsLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    status: InvoiceStatus
    title: string
    description: string
  } | null>(null)

  const handleStatusChange = async (status: InvoiceStatus) => {
    setIsLoading(true)
    try {
      const result = await updateInvoiceStatusAction(invoice.id, status)
      if (result.success) {
        toast.success('Statut mis à jour')
      } else {
        toast.error(result.error || 'Erreur lors de la mise à jour')
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setIsLoading(false)
      setConfirmAction(null)
    }
  }

  const confirmStatusChange = (
    status: InvoiceStatus,
    title: string,
    description: string
  ) => {
    setConfirmAction({ status, title, description })
  }

  // Actions principales selon le statut actuel
  if (invoice.status === 'draft') {
    return (
      <>
        <Button
          onClick={() =>
            confirmStatusChange(
              'sent',
              'Marquer comme envoyée ?',
              "Cette action indique que la facture a été envoyée au client. Vous ne pourrez plus la modifier."
            )
          }
          disabled={isLoading}
        >
          <Send className="mr-2 h-4 w-4" />
          Marquer envoyée
        </Button>

        <AlertDialog
          open={!!confirmAction}
          onOpenChange={() => setConfirmAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>
                {t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  confirmAction && handleStatusChange(confirmAction.status)
                }
                disabled={isLoading}
              >
                {isLoading ? t('common.loading') : 'Confirmer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  if (invoice.status === 'sent' || invoice.status === 'overdue') {
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
                confirmStatusChange(
                  'paid',
                  'Marquer comme payée ?',
                  "Cette action indique que le client a réglé la facture."
                )
              }
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Marquer comme payée
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                confirmStatusChange(
                  'cancelled',
                  'Annuler la facture ?',
                  "Cette action annulera définitivement la facture. Elle restera visible mais ne pourra plus être modifiée."
                )
              }
              className="text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Annuler la facture
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog
          open={!!confirmAction}
          onOpenChange={() => setConfirmAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>
                {t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  confirmAction && handleStatusChange(confirmAction.status)
                }
                disabled={isLoading}
                className={
                  confirmAction?.status === 'cancelled'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : ''
                }
              >
                {isLoading ? t('common.loading') : 'Confirmer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  // Pour paid et cancelled, pas d'actions disponibles
  return null
}
