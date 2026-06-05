'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2, CheckCircle2 } from 'lucide-react'

interface LifecycleEvent {
  statusCode: string
  statusText?: string
  occurredAt: string
  reason?: string
}

// Affiche le cycle de vie e-invoicing d'une facture transmise via la PDP.
// Se charge au montage et propose un rafraîchissement (les statuts évoluent côté PDP).
export function PdpLifecycle({ invoiceId }: { invoiceId: string }) {
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
    } catch {
      // silencieux
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    load()
  }, [load])

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Cycle de vie (PDP)</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {depositId && (
          <p className="mb-3 text-xs text-muted-foreground">Dépôt PDP n° {depositId}</p>
        )}
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? 'Chargement…' : 'Aucun événement pour le moment.'}
          </p>
        ) : (
          <ol className="space-y-3">
            {events.map((e, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                <div>
                  <p className="font-medium">{e.statusText || e.statusCode}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(e.occurredAt)}
                    {e.reason ? ` — ${e.reason}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
