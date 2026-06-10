'use client'

// Contenu de la page devis : lit le store live (charte règle 2) — aucune requête
// Supabase ici, le LiveStoreProvider (layout dashboard) garde les données vivantes.
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QuoteDialog } from '@/components/quotes/quote-dialog'
import { QuotesTable } from '@/components/quotes/quotes-table'
import { useLiveCompany, useLiveClients, useLiveQuotes } from '@/lib/realtime'

export function QuotesContent() {
  const t = useTranslations()
  const company = useLiveCompany()
  const clients = useLiveClients()
  const quotes = useLiveQuotes()

  if (!company) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('quotes.title')}</h1>
          <p className="text-muted-foreground">Gérez vos devis.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('common.setupRequired')}</CardTitle>
            <CardDescription>{t('common.setupRequiredQuotes')}</CardDescription>
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
          <QuotesTable />
        </CardContent>
      </Card>
    </div>
  )
}
