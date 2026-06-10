'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { BarChart3, CheckCircle2, Loader2 } from 'lucide-react'
import { useLiveInvoice } from '@/lib/realtime'

export function EreportB2cButton({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations('einvoicing')
  const locale = useLocale()
  const [loading, setLoading] = useState(false)
  const invoice = useLiveInvoice(invoiceId)

  const reportedAt = invoice?.pdp_ereported_at ?? null

  const handle = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/ereport`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t('ereportError'))
        return
      }
      if (data.alreadyReported) {
        toast.info(t('ereportAlreadyReported'))
      } else {
        toast.success(t('ereportSuccess'))
      }
      // Le Realtime réconcilie pdp_ereported_at ; pas de refresh nécessaire.
    } catch (error) {
      console.error('Déclaration e-reporting échouée', error)
      toast.error(t('pdpUnreachable'))
    } finally {
      setLoading(false)
    }
  }

  if (reportedAt) {
    const date = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR').format(new Date(reportedAt))
    return (
      <Button variant="outline" className="w-full" disabled aria-disabled>
        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
        {t('ereportedOn', { date })}
      </Button>
    )
  }

  return (
    <Button variant="outline" className="w-full" onClick={handle} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <BarChart3 className="mr-2 h-4 w-4" />
      )}
      {t('ereportButton')}
    </Button>
  )
}
