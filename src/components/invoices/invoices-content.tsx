'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InvoiceDialog } from '@/components/invoices/invoice-dialog'
import { InvoicesTable } from '@/components/invoices/invoices-table'
import { useLiveCompany, useLiveClients, useLiveInvoices } from '@/lib/realtime'

export function InvoicesContent() {
  const t = useTranslations()
  const company = useLiveCompany()
  const clients = useLiveClients()
  const invoices = useLiveInvoices()

  if (!company) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('invoices.title')}</h1>
          <p className="text-muted-foreground">Gérez vos factures et devis.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('common.setupRequired')}</CardTitle>
            <CardDescription>{t('common.setupRequiredInvoices')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard">{t('common.finishSetup')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('invoices.title')}</h1>
          <p className="text-muted-foreground">
            {invoices.length} facture{invoices.length !== 1 ? 's' : ''}
          </p>
        </div>
        <InvoiceDialog clients={clients} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('invoices.title')}</CardTitle>
          <CardDescription>Toutes vos factures au même endroit.</CardDescription>
        </CardHeader>
        <CardContent>
          <InvoicesTable />
        </CardContent>
      </Card>
    </div>
  )
}
