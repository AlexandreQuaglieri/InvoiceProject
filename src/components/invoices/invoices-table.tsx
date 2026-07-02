'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Copy,
  Send,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EinvoicingBadge } from '@/components/invoices/einvoicing-badge'

import {
  deleteInvoiceAction,
  updateInvoiceStatusAction,
  duplicateInvoiceAction,
} from '@/actions/invoices'
import { useLiveInvoices, useLiveStoreActions } from '@/lib/realtime'
import type { InvoiceWithRelations, InvoiceStatus } from '@/types/database'

const statusConfig: Record<InvoiceStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Brouillon', variant: 'secondary', icon: Clock },
  sent: { label: 'Envoyée', variant: 'default', icon: Send },
  paid: { label: 'Payée', variant: 'default', icon: CheckCircle },
  overdue: { label: 'En retard', variant: 'destructive', icon: Clock },
  cancelled: { label: 'Annulée', variant: 'outline', icon: XCircle },
}

export function InvoicesTable() {
  const t = useTranslations()
  const router = useRouter()
  const invoices = useLiveInvoices()
  const { upsertInvoice, removeInvoice } = useLiveStoreActions()
  const [, startTransition] = useTransition()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(date))
  }

  const handleDelete = () => {
    if (!deleteId) return

    const prev = invoices.find((invoice) => invoice.id === deleteId)
    if (!prev) {
      setDeleteId(null)
      return
    }

    // Optimistic : retrait immédiat, rollback si le serveur refuse
    removeInvoice(prev.id)
    setDeleteId(null)
    startTransition(async () => {
      try {
        const result = await deleteInvoiceAction(prev.id)
        if (result.success) {
          toast.success('Facture supprimée')
        } else {
          upsertInvoice(prev)
          toast.error(result.error || 'Erreur lors de la suppression')
        }
      } catch (error) {
        console.error('Suppression de la facture échouée', error)
        upsertInvoice(prev)
        toast.error('Erreur lors de la suppression')
      }
    })
  }

  const handleStatusChange = (invoice: InvoiceWithRelations, status: InvoiceStatus) => {
    const prev = invoice
    // Optimistic : NE PAS modifier updated_at (l'event Realtime, plus frais, doit gagner)
    upsertInvoice({ ...invoice, status })
    startTransition(async () => {
      try {
        const result = await updateInvoiceStatusAction(invoice.id, status)
        if (result.success) {
          toast.success('Statut mis à jour')
        } else {
          upsertInvoice(prev)
          toast.error(result.error || 'Erreur lors de la mise à jour')
        }
      } catch (error) {
        console.error('Mise à jour du statut de la facture échouée', error)
        upsertInvoice(prev)
        toast.error('Erreur lors de la mise à jour')
      }
    })
  }

  const handleDuplicate = async (id: string) => {
    try {
      const result = await duplicateInvoiceAction(id)
      if (result.success && result.data) {
        upsertInvoice(result.data)
        toast.success('Facture dupliquée')
        router.push(`/invoices/${result.data.id}`)
      } else {
        toast.error(result.error || 'Erreur lors de la duplication')
      }
    } catch (error) {
      console.error('Duplication de la facture échouée', error)
      toast.error('Erreur lors de la duplication')
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Aucune facture pour le moment.</p>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('invoices.number')}</TableHead>
            <TableHead>{t('invoices.client')}</TableHead>
            <TableHead>{t('invoices.issueDate')}</TableHead>
            <TableHead>{t('invoices.dueDate')}</TableHead>
            <TableHead>{t('invoices.status')}</TableHead>
            <TableHead className="text-right">{t('invoices.totalTtc')}</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const status = statusConfig[invoice.status]
            const StatusIcon = status.icon

            return (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.number}</TableCell>
                <TableCell>{invoice.client?.name || '-'}</TableCell>
                <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                <TableCell>{formatDate(invoice.due_date)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant={status.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                    <EinvoicingBadge invoice={invoice} />
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(invoice.total_ttc)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/invoices/${invoice.id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Voir
                      </DropdownMenuItem>

                      {invoice.status === 'draft' && (
                        <DropdownMenuItem
                          onClick={() => router.push(`/invoices/${invoice.id}/edit`)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          {t('common.edit')}
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuItem onClick={() => handleDuplicate(invoice.id)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Dupliquer
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {invoice.status === 'draft' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(invoice, 'sent')}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Finaliser la facture
                        </DropdownMenuItem>
                      )}

                      {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(invoice, 'paid')}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Marquer comme payée
                        </DropdownMenuItem>
                      )}

                      {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(invoice, 'cancelled')}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Annuler
                        </DropdownMenuItem>
                      )}

                      {invoice.status === 'draft' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(invoice.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La facture sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
