'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  MoreHorizontal,
  Trash2,
  Eye,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  RefreshCw,
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
  deleteQuote,
  updateQuoteStatus,
  convertQuoteToInvoice,
} from '@/actions/quotes'
import type { QuoteWithRelations, QuoteStatus } from '@/types/database'

interface QuotesTableProps {
  quotes: QuoteWithRelations[]
}

const statusConfig: Record<QuoteStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Brouillon', variant: 'secondary', icon: Clock },
  sent: { label: 'Envoyé', variant: 'default', icon: Send },
  accepted: { label: 'Accepté', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Refusé', variant: 'destructive', icon: XCircle },
  expired: { label: 'Expiré', variant: 'outline', icon: Clock },
  converted: { label: 'Converti', variant: 'default', icon: FileText },
}

export function QuotesTable({ quotes }: QuotesTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [convertingId, setConvertingId] = useState<string | null>(null)

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
      const result = await deleteQuote(deleteId)
      if (result.success) {
        toast.success('Devis supprimé')
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

  const handleStatusChange = async (id: string, status: QuoteStatus) => {
    try {
      const result = await updateQuoteStatus(id, status)
      if (result.success) {
        toast.success('Statut mis à jour')
      } else {
        toast.error(result.error || 'Erreur lors de la mise à jour')
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const handleConvert = async (id: string) => {
    setConvertingId(id)
    try {
      const result = await convertQuoteToInvoice(id)
      if (result.success && result.invoiceId) {
        toast.success('Devis converti en facture')
        router.push(`/invoices/${result.invoiceId}`)
      } else {
        toast.error(result.error || 'Erreur lors de la conversion')
      }
    } catch (error) {
      toast.error('Erreur lors de la conversion')
    } finally {
      setConvertingId(null)
    }
  }

  if (quotes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Aucun devis pour le moment.</p>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('quotes.number')}</TableHead>
            <TableHead>{t('quotes.client')}</TableHead>
            <TableHead>{t('quotes.issueDate')}</TableHead>
            <TableHead>{t('quotes.validityDate')}</TableHead>
            <TableHead>{t('quotes.status')}</TableHead>
            <TableHead className="text-right">{t('quotes.total')}</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((quote) => {
            const status = statusConfig[quote.status]
            const StatusIcon = status.icon
            const isExpired = new Date(quote.validity_date) < new Date() && quote.status !== 'converted' && quote.status !== 'accepted'

            return (
              <TableRow key={quote.id}>
                <TableCell className="font-medium">{quote.quote_number}</TableCell>
                <TableCell>{quote.client?.name || '-'}</TableCell>
                <TableCell>{formatDate(quote.issue_date)}</TableCell>
                <TableCell className={isExpired ? 'text-destructive' : ''}>
                  {formatDate(quote.validity_date)}
                </TableCell>
                <TableCell>
                  <Badge variant={isExpired && quote.status !== 'converted' ? 'destructive' : status.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {isExpired && quote.status !== 'converted' && quote.status !== 'accepted' ? 'Expiré' : status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(quote.total)}
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
                        onClick={() => router.push(`/quotes/${quote.id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Voir
                      </DropdownMenuItem>

                      {quote.status === 'draft' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(quote.id, 'sent')}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Marquer comme envoyé
                        </DropdownMenuItem>
                      )}

                      {quote.status === 'sent' && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(quote.id, 'accepted')}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Marquer comme accepté
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(quote.id, 'rejected')}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Marquer comme refusé
                          </DropdownMenuItem>
                        </>
                      )}

                      {(quote.status === 'accepted' || quote.status === 'sent') && quote.status !== 'converted' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleConvert(quote.id)}
                            disabled={convertingId === quote.id}
                          >
                            {convertingId === quote.id ? (
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="mr-2 h-4 w-4" />
                            )}
                            Convertir en facture
                          </DropdownMenuItem>
                        </>
                      )}

                      {quote.status !== 'converted' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(quote.id)}
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
            <AlertDialogTitle>Supprimer le devis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le devis sera définitivement supprimé.
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
