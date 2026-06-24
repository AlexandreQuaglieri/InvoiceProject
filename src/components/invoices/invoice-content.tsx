'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
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
} from 'lucide-react'
import { InvoiceStatusActions } from '@/components/invoices/invoice-status-actions'
import { EinvoicingBadge } from '@/components/invoices/einvoicing-badge'
import { DownloadPdfButton } from '@/components/invoices/download-pdf-button'
import { TransmitChorusProButton } from '@/components/invoices/transmit-chorus-pro-button'
import { TransmitPdpButton } from '@/components/invoices/transmit-pdp-button'
import { EreportB2cButton } from '@/components/invoices/ereport-b2c-button'
import { ActivatePdpButton } from '@/components/invoices/activate-pdp-button'
import { PdpLifecycle } from '@/components/invoices/pdp-lifecycle'
import { useLiveCompany, useLiveInvoice } from '@/lib/realtime'
import type { InvoiceStatus } from '@/types/database'

interface InvoiceContentProps {
  invoiceId: string
  pdpConnected: boolean
}

const statusConfig: Record<
  InvoiceStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  draft: { label: 'Brouillon', variant: 'secondary', icon: Clock },
  sent: { label: 'Envoyée', variant: 'default', icon: Send },
  paid: { label: 'Payée', variant: 'default', icon: CheckCircle },
  overdue: { label: 'En retard', variant: 'destructive', icon: Clock },
  cancelled: { label: 'Annulée', variant: 'outline', icon: XCircle },
}

export function InvoiceContent({ invoiceId, pdpConnected }: InvoiceContentProps) {
  const t = useTranslations()
  const invoice = useLiveInvoice(invoiceId)
  const company = useLiveCompany()

  if (!invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('invoices.notFound')}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('invoices.notFound')}</CardTitle>
            <CardDescription>{t('invoices.notFoundDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/invoices">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('invoices.backToList')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const status = statusConfig[invoice.status]
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
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {invoice.number}
              </h1>
              <Badge variant={status.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
              <EinvoicingBadge invoice={invoice} />
            </div>
            <p className="text-muted-foreground">
              {invoice.client?.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'draft' && (
            <Link href={`/invoices/${invoice.id}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                {t('common.edit')}
              </Button>
            </Link>
          )}
          <InvoiceStatusActions invoice={invoice} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Détails de la facture */}
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
                  <h3 className="font-semibold mb-2">Facturer à</h3>
                  {invoice.client && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">{invoice.client.name}</p>
                      <p>{invoice.client.address}</p>
                      <p>{invoice.client.postal_code} {invoice.client.city}</p>
                      {invoice.client.email && <p>{invoice.client.email}</p>}
                      {invoice.client.siret && <p className="pt-2">SIRET: {invoice.client.siret}</p>}
                      {invoice.client.vat_number && <p>TVA: {invoice.client.vat_number}</p>}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lignes de facture */}
          <Card>
            <CardHeader>
              <CardTitle>Lignes de facture</CardTitle>
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
                    {invoice.items?.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-3">{item.description}</td>
                        <td className="text-right py-3">{item.quantity}</td>
                        <td className="text-right py-3">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right py-3">{item.vat_rate}%</td>
                        <td className="text-right py-3 font-medium">{formatCurrency(item.total_ht)}</td>
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
                  <span className="font-medium">{formatCurrency(invoice.total_ht)}</span>
                </div>
                {invoice.discount_value && invoice.discount_value > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      Remise ({invoice.discount_type === 'percentage' ? `${invoice.discount_value}%` : formatCurrency(invoice.discount_value)})
                    </span>
                    <span>-</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total TVA</span>
                  <span className="font-medium">{formatCurrency(invoice.total_vat)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total TTC</span>
                  <span className="font-bold">{formatCurrency(invoice.total_ttc)}</span>
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
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {invoice.notes}
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
                <p className="font-medium">{formatDate(invoice.issue_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date d&apos;échéance</p>
                <p className="font-medium">{formatDate(invoice.due_date)}</p>
              </div>
              {invoice.payment_terms && (
                <div>
                  <p className="text-sm text-muted-foreground">Conditions de paiement</p>
                  <p className="font-medium">{invoice.payment_terms}</p>
                </div>
              )}
              {invoice.paid_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Payée le</p>
                  <p className="font-medium">{formatDate(invoice.paid_at)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DownloadPdfButton invoiceId={invoice.id} />
              <TransmitPdpButton
                invoiceId={invoice.id}
                canTransmit={
                  invoice.status !== 'draft' &&
                  invoice.client?.type === 'professional' &&
                  pdpConnected
                }
              />
              {invoice.status !== 'draft' &&
                invoice.client?.type === 'individual' &&
                pdpConnected && <EreportB2cButton invoiceId={invoice.id} />}
              {invoice.status !== 'draft' && !pdpConnected && (
                <ActivatePdpButton className="w-full" label="Connecter à la PDP pour transmettre" />
              )}
              {invoice.status !== 'draft' && (
                <TransmitChorusProButton invoiceId={invoice.id} />
              )}
            </CardContent>
          </Card>

          {invoice.pdp_deposit_id && <PdpLifecycle invoiceId={invoice.id} />}
        </div>
      </div>
    </div>
  )
}
