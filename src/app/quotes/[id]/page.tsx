import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Pencil,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getQuote } from '@/actions/quotes'
import { getCompany } from '@/actions/company'
import { QuoteStatusActions } from '@/components/quotes/quote-status-actions'
import { DownloadQuotePdfButton } from '@/components/quotes/download-quote-pdf-button'
import type { QuoteStatus } from '@/types/database'

interface QuotePageProps {
  params: Promise<{ id: string }>
}

const statusConfig: Record<
  QuoteStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  draft: { label: 'Brouillon', variant: 'secondary', icon: Clock },
  sent: { label: 'Envoyé', variant: 'default', icon: Send },
  accepted: { label: 'Accepté', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Refusé', variant: 'destructive', icon: XCircle },
  expired: { label: 'Expiré', variant: 'outline', icon: Clock },
  converted: { label: 'Converti', variant: 'secondary', icon: RefreshCw },
}

export default async function QuotePage({ params }: QuotePageProps) {
  const { id } = await params
  const quote = await getQuote(id)
  const company = await getCompany()

  if (!quote) {
    notFound()
  }

  return (
    <DashboardLayout>
      <QuoteContent quote={quote} company={company} />
    </DashboardLayout>
  )
}

function QuoteContent({
  quote,
  company,
}: {
  quote: NonNullable<Awaited<ReturnType<typeof getQuote>>>
  company: Awaited<ReturnType<typeof getCompany>>
}) {
  const status = statusConfig[quote.status]
  const StatusIcon = status.icon

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'long',
    }).format(new Date(date))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/quotes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {quote.quote_number}
              </h1>
              <Badge variant={status.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {quote.client?.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {quote.status === 'draft' && (
            <Link href={`/quotes/${quote.id}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </Button>
            </Link>
          )}
          <QuoteStatusActions quote={quote} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Détails du devis */}
        <div className="lg:col-span-2 space-y-6">
          {/* En-tête entreprise / client */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Entreprise */}
                <div>
                  <h3 className="font-semibold mb-2">De</h3>
                  {company && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">{company.name}</p>
                      <p>{company.address}</p>
                      <p>{company.postal_code} {company.city}</p>
                      <p>{company.email}</p>
                      {company.phone && <p>{company.phone}</p>}
                      <p className="pt-2">SIRET: {company.siret}</p>
                      {company.vat_number && <p>TVA: {company.vat_number}</p>}
                    </div>
                  )}
                </div>

                {/* Client */}
                <div>
                  <h3 className="font-semibold mb-2">Devis pour</h3>
                  {quote.client && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">{quote.client.name}</p>
                      <p>{quote.client.address}</p>
                      <p>{quote.client.postal_code} {quote.client.city}</p>
                      {quote.client.email && <p>{quote.client.email}</p>}
                      {quote.client.siret && <p className="pt-2">SIRET: {quote.client.siret}</p>}
                      {quote.client.vat_number && <p>TVA: {quote.client.vat_number}</p>}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lignes du devis */}
          <Card>
            <CardHeader>
              <CardTitle>Lignes du devis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-sm text-muted-foreground">
                      <th className="text-left py-3 font-medium">Description</th>
                      <th className="text-right py-3 font-medium">Qté</th>
                      <th className="text-right py-3 font-medium">Prix unit. HT</th>
                      <th className="text-right py-3 font-medium">TVA</th>
                      <th className="text-right py-3 font-medium">Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items?.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-3">{item.description}</td>
                        <td className="text-right py-3">{item.quantity}</td>
                        <td className="text-right py-3">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right py-3">{item.tax_rate}%</td>
                        <td className="text-right py-3 font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Separator className="my-4" />

              {/* Totaux */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total HT</span>
                  <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total TVA</span>
                  <span className="font-medium">{formatCurrency(quote.tax_amount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total TTC</span>
                  <span className="font-bold">{formatCurrency(quote.total)}</span>
                </div>
                {company?.vat_regime === 'franchise' && (
                  <p className="text-xs text-muted-foreground pt-2 italic">
                    TVA non applicable, art. 293 B du CGI
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {quote.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Conditions */}
          {quote.terms && (
            <Card>
              <CardHeader>
                <CardTitle>Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {quote.terms}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Date d&apos;émission</p>
                <p className="font-medium">{formatDate(quote.issue_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date de validité</p>
                <p className="font-medium">{formatDate(quote.validity_date)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DownloadQuotePdfButton quoteId={quote.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
