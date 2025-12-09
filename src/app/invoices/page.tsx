import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { InvoiceDialog } from '@/components/invoices/invoice-dialog'
import { InvoicesTable } from '@/components/invoices/invoices-table'
import { getInvoices } from '@/actions/invoices'
import { getClients } from '@/actions/clients'
import { getCompany } from '@/actions/company'

export default async function InvoicesPage() {
  const company = await getCompany()
  const clients = company ? await getClients() : []
  const invoices = company ? await getInvoices() : []

  return (
    <DashboardLayout>
      <InvoicesContent
        invoices={invoices}
        clients={clients}
        hasCompany={!!company}
      />
    </DashboardLayout>
  )
}

function InvoicesContent({
  invoices,
  clients,
  hasCompany,
}: {
  invoices: Awaited<ReturnType<typeof getInvoices>>
  clients: Awaited<ReturnType<typeof getClients>>
  hasCompany: boolean
}) {
  const t = useTranslations()

  if (!hasCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('invoices.title')}</h1>
          <p className="text-muted-foreground">Gérez vos factures et devis.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuration requise</CardTitle>
            <CardDescription>
              Vous devez d'abord configurer votre entreprise avant de pouvoir créer des factures.
            </CardDescription>
          </CardHeader>
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
          <InvoicesTable invoices={invoices} />
        </CardContent>
      </Card>
    </div>
  )
}
