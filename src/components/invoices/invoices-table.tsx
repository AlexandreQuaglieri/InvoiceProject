'use client'

import { useState } from 'react'
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

import {
  deleteInvoiceAction,
  updateInvoiceStatusAction,
  duplicateInvoiceAction,
} from '@/actions/invoices'
import type { InvoiceWithRelations, InvoiceStatus } from '@/types/database'

interface InvoicesTableProps {
  invoices: InvoiceWithRelations[]
}

const statusConfig: Record<InvoiceStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Brouillon', variant: 'secondary', icon: Clock },
  sent: { label: 'Envoyée', variant: 'default', icon: Send },
  paid: { label: 'Payée', variant: 'default', icon: CheckCircle },
  overdue: { label: 'En retard', variant: 'destructive', icon: Clock },
  cancelled: { label: 'Annulée', variant: 'outline', icon: XCircle },
}

export function InvoicesTable({ invoices }: InvoicesTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(date))
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    try {
      const result = await deleteInvoiceAction(deleteId)
      if (result.success) {
        toast.success('Facture supprimée')
      } else {
        toast.error(result.error || 'Erreur lors de la suppression')
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  const handleStatusChange = async (id: string, status: InvoiceStatus) => {
    try {
      const result = await updateInvoiceStatusAction(id, status)
      if (result.success) {
        toast.success('Statut mis à jour')
      } else {
        toast.error(result.error || 'Erreur lors de la mise à jour')
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      const result = await duplicateInvoiceAction(id)
      if (result.success && result.data) {
        toast.success('Facture dupliquée')
        router.push(`/invoices/${result.data.id}`)
      } else {
        toast.error(result.error || 'Erreur lors de la duplication')
      }
    } catch (error) {
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
                  <Badge variant={status.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>
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
                          onClick={() => handleStatusChange(invoice.id, 'sent')}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Marquer comme envoyée
                        </DropdownMenuItem>
                      )}

                      {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(invoice.id, 'paid')}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Marquer comme payée
                        </DropdownMenuItem>
                      )}

                      {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(invoice.id, 'cancelled')}
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
            <AlertDialogCancel disabled={isDeleting}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
