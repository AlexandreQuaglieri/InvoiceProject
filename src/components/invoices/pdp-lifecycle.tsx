'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { statusInfo } from '@/lib/einvoicing/status'

interface LifecycleEvent {
  statusCode: string
  statusText?: string
  occurredAt: string
  reason?: string
}

// Affiche le cycle de vie e-invoicing d'une facture transmise via la PDP.
// Se charge au montage et propose un rafraîchissement (les statuts évoluent côté PDP).
export function PdpLifecycle({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations()
  const locale = useLocale()
  const [events, setEvents] = useState<LifecycleEvent[]>([])
  const [depositId, setDepositId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdp-events`)
      const data = await res.json()
      if (res.ok) {
        setDepositId(data.depositId || null)
        setEvents(Array.isArray(data.events) ? data.events : [])
      }
    } catch (error) {
      // silencieux côté UI, mais loggé
      console.error('Récupération des événements PDP échouée', error)
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    load()
  }, [load])

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{t('einvoicing.lifecycle.title')}</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={load}
          disabled={loading}
          aria-label={t('einvoicing.lifecycle.refresh')}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {depositId && (
          <p className="mb-3 text-xs text-muted-foreground">
            {t('einvoicing.lifecycle.deposit', { depositId })}
          </p>
        )}
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? t('einvoicing.lifecycle.loading') : t('einvoicing.lifecycle.empty')}
          </p>
        ) : (
          <ol className="space-y-3">
            {events.map((e, i) => {
              const info = statusInfo(e.statusCode)
              const label = info
                ? t(`einvoicing.status.${info.labelKey}`)
                : e.statusText || e.statusCode
              // Icône selon le ton du statut : croix pour refusée/rejetée,
              // triangle pour litige/suspendue, coche sinon.
              const Icon =
                info?.tone === 'destructive'
                  ? XCircle
                  : info?.tone === 'warning'
                    ? AlertTriangle
                    : CheckCircle2
              const iconColor =
                info?.tone === 'destructive'
                  ? 'text-destructive'
                  : info?.tone === 'warning'
                    ? 'text-amber-500'
                    : 'text-green-500'
              return (
                <li key={i} className="flex gap-3 text-sm">
                  <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconColor}`} />
                  <div>
                    <p className="font-medium">{label}</p>
                    {info && e.statusText && (
                      <p className="text-xs text-muted-foreground">{e.statusText}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.occurredAt)}
                      {e.reason ? ` — ${e.reason}` : ''}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
