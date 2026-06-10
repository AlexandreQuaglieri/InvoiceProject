'use client'

// Inbox des factures reçues (e-invoicing entrant). Composant UI pur :
// lecture via le store live, mutations via les server actions + optimistic.
import { useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  CheckCircle,
  Download,
  Inbox as InboxIcon,
  Plug,
  RefreshCw,
  XCircle,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { syncInboundAction, setInboundStatusAction } from '@/actions/inbound'
import { useLiveInboundInvoices, useLiveStoreActions } from '@/lib/realtime'
import type { InboundInvoice } from '@/types/database'

const REFUSAL_REASON_MAX = 500

export function InboxContent() {
  const t = useTranslations('inbox')
  const locale = useLocale()
  const inbound = useLiveInboundInvoices()
  const { upsertInbound } = useLiveStoreActions()
  const [, startTransition] = useTransition()

  const [syncing, setSyncing] = useState(false)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<InboundInvoice | null>(null)
  const [refuseTarget, setRefuseTarget] = useState<InboundInvoice | null>(null)
  const [refuseReason, setRefuseReason] = useState('')
  const syncStartedRef = useRef(false)

  const runSync = () => {
    setSyncing(true)
    setSyncError(null)
    syncInboundAction()
      .then((result) => {
        setConnected(result.connected)
        if (!result.success) {
          const message = result.error || t('toasts.syncError')
          setSyncError(message)
          toast.error(message)
        }
      })
      .catch((error) => {
        console.error('Synchronisation des factures reçues échouée', error)
        setSyncError(t('toasts.syncError'))
        toast.error(t('toasts.syncError'))
      })
      .finally(() => setSyncing(false))
  }

  // Sync au montage, une seule fois (la liste locale du store s'affiche sans attendre).
  useEffect(() => {
    if (syncStartedRef.current) return
    syncStartedRef.current = true
    runSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(new Date(date))

  const formatAmount = (amount: number, currency: string | null) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EUR' }).format(amount)

  const setStatus = (row: InboundInvoice, action: 'approve' | 'refuse', reason?: string) => {
    const prev = row
    // Optimistic : NE PAS modifier updated_at (l'event Realtime, plus frais, doit gagner)
    const optimistic: InboundInvoice =
      action === 'approve'
        ? { ...row, local_status: 'approved' }
        : { ...row, local_status: 'refused', refusal_reason: reason ?? null }
    upsertInbound(optimistic)

    startTransition(async () => {
      try {
        const result = await setInboundStatusAction({ inboundId: row.id, action, reason })
        if (result.success && result.data) {
          upsertInbound(result.data)
          toast.success(action === 'approve' ? t('toasts.approveSuccess') : t('toasts.refuseSuccess'))
        } else {
          upsertInbound(prev)
          toast.error(result.error || t('toasts.error'))
        }
      } catch (error) {
        console.error('Changement de statut de la facture reçue échoué', error)
        upsertInbound(prev)
        toast.error(t('toasts.error'))
      }
    })
  }

  const handleApprove = () => {
    if (!approveTarget) return
    const row = approveTarget
    setApproveTarget(null)
    setStatus(row, 'approve')
  }

  const handleRefuse = () => {
    if (!refuseTarget) return
    const reason = refuseReason.trim()
    if (!reason) return
    const row = refuseTarget
    setRefuseTarget(null)
    setRefuseReason('')
    setStatus(row, 'refuse', reason)
  }

  const statusBadge = (row: InboundInvoice) => {
    switch (row.local_status) {
      case 'approved':
        return (
          <Badge variant="default">
            <CheckCircle aria-hidden="true" />
            {t('status.approved')}
          </Badge>
        )
      case 'refused':
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant="destructive">
              <XCircle aria-hidden="true" />
              {t('status.refused')}
            </Badge>
            {row.refusal_reason && (
              <span className="max-w-[16rem] truncate text-xs text-muted-foreground" title={row.refusal_reason}>
                {t('refusalReason', { reason: row.refusal_reason })}
              </span>
            )}
          </div>
        )
      default:
        return <Badge variant="secondary">{t('status.new')}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button variant="outline" onClick={runSync} disabled={syncing} aria-busy={syncing}>
          <RefreshCw className={syncing ? 'animate-spin' : undefined} aria-hidden="true" />
          {syncing ? t('syncing') : t('sync')}
        </Button>
      </div>

      {syncError && (
        <p role="alert" className="text-sm text-destructive">
          {syncError}
        </p>
      )}

      {connected === false && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              {t('connectTitle')}
            </CardTitle>
            <CardDescription>{t('connectPrompt')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings?tab=einvoicing">{t('connectCta')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {inbound.length === 0 ? (
        connected !== false && (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <InboxIcon className="mb-3 h-10 w-10 opacity-50" aria-hidden="true" />
              <p>{t('empty')}</p>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('count', { count: inbound.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.receivedAt')}</TableHead>
                  <TableHead>{t('columns.seller')}</TableHead>
                  <TableHead>{t('columns.number')}</TableHead>
                  <TableHead className="text-right">{t('columns.amount')}</TableHead>
                  <TableHead>{t('columns.status')}</TableHead>
                  <TableHead className="text-right">{t('columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inbound.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.received_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{row.seller_name || '—'}</span>
                        {row.seller_vat && (
                          <span className="text-xs text-muted-foreground">{row.seller_vat}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{row.number || row.external_id || '—'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {row.total_with_vat != null ? formatAmount(row.total_with_vat, row.currency) : '—'}
                    </TableCell>
                    <TableCell>{statusBadge(row)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {row.local_status === 'new' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => setApproveTarget(row)}>
                              <CheckCircle aria-hidden="true" />
                              {t('actions.approve')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setRefuseReason('')
                                setRefuseTarget(row)
                              }}
                            >
                              <XCircle aria-hidden="true" />
                              {t('actions.refuse')}
                            </Button>
                          </>
                        )}
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/api/inbox/${row.deposit_id}/download`} aria-label={t('actions.download')}>
                            <Download aria-hidden="true" />
                            {t('actions.download')}
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('approveDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('approveDialog.description', {
                number: approveTarget?.number || approveTarget?.external_id || '—',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('refuseDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove}>{t('approveDialog.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!refuseTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRefuseTarget(null)
            setRefuseReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('refuseDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('refuseDialog.description', {
                number: refuseTarget?.number || refuseTarget?.external_id || '—',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="inbox-refusal-reason">{t('refuseDialog.reasonLabel')}</Label>
            <Textarea
              id="inbox-refusal-reason"
              value={refuseReason}
              onChange={(e) => setRefuseReason(e.target.value)}
              placeholder={t('refuseDialog.reasonPlaceholder')}
              maxLength={REFUSAL_REASON_MAX}
              rows={4}
              required
              aria-required="true"
            />
            <p className="text-xs text-muted-foreground">
              {refuseReason.length}/{REFUSAL_REASON_MAX}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRefuseTarget(null)
                setRefuseReason('')
              }}
            >
              {t('refuseDialog.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleRefuse} disabled={!refuseReason.trim()}>
              {t('refuseDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
