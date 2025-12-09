import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { QuoteDialog } from '@/components/quotes/quote-dialog'
import { QuotesTable } from '@/components/quotes/quotes-table'
import { getQuotes } from '@/actions/quotes'
import { getClients } from '@/actions/clients'
import { getCompany } from '@/actions/company'

export default async function QuotesPage() {
  const company = await getCompany()
  const clients = company ? await getClients() : []
  const quotes = company ? await getQuotes() : []

  return (
    <DashboardLayout>
      <QuotesContent
        quotes={quotes}
        clients={clients}
        hasCompany={!!company}
      />
    </DashboardLayout>
  )
}

function QuotesContent({
  quotes,
  clients,
  hasCompany,
}: {
  quotes: Awaited<ReturnType<typeof getQuotes>>
  clients: Awaited<ReturnType<typeof getClients>>
  hasCompany: boolean
}) {
  const t = useTranslations()

  if (!hasCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('quotes.title')}</h1>
          <p className="text-muted-foreground">Gérez vos devis.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuration requise</CardTitle>
            <CardDescription>
              Vous devez d'abord configurer votre entreprise avant de pouvoir créer des devis.
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
          <h1 className="text-3xl font-bold tracking-tight">{t('quotes.title')}</h1>
          <p className="text-muted-foreground">
            {quotes.length} devis
          </p>
        </div>
        <QuoteDialog clients={clients} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('quotes.title')}</CardTitle>
          <CardDescription>Tous vos devis au même endroit.</CardDescription>
        </CardHeader>
        <CardContent>
          <QuotesTable quotes={quotes} />
        </CardContent>
      </Card>
    </div>
  )
}
