import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Clock, AlertTriangle, FileText, Users, Euro, Send, CheckCircle } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCompany } from '@/actions/company'
import {
  getInvoiceStats,
  getRecentInvoices,
  getOverdueInvoices,
  getTopClients,
} from '@/actions/invoices'
import type { InvoiceStatus } from '@/types/database'

export default async function DashboardPage() {
  const company = await getCompany()
  const stats = company ? await getInvoiceStats() : null
  const recentInvoices = company ? await getRecentInvoices(5) : []
  const overdueInvoices = company ? await getOverdueInvoices() : []
  const topClients = company ? await getTopClients(5) : []

  return (
    <DashboardLayout>
      <DashboardContent
        hasCompany={!!company}
        stats={stats}
        recentInvoices={recentInvoices}
        overdueInvoices={overdueInvoices}
        topClients={topClients}
      />
    </DashboardLayout>
  )
}

const statusConfig: Record<InvoiceStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Brouillon', variant: 'secondary' },
  sent: { label: 'Envoyée', variant: 'default' },
  paid: { label: 'Payée', variant: 'default' },
  overdue: { label: 'En retard', variant: 'destructive' },
  cancelled: { label: 'Annulée', variant: 'outline' },
}

function DashboardContent({
  hasCompany,
  stats,
  recentInvoices,
  overdueInvoices,
  topClients,
}: {
  hasCompany: boolean
  stats: Awaited<ReturnType<typeof getInvoiceStats>> | null
  recentInvoices: Awaited<ReturnType<typeof getRecentInvoices>>
  overdueInvoices: Awaited<ReturnType<typeof getOverdueInvoices>>
  topClients: Awaited<ReturnType<typeof getTopClients>>
}) {
  const t = useTranslations()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(date))
  }

  if (!hasCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('auth.subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuration requise</CardTitle>
            <CardDescription>
              Vous devez d'abord configurer votre entreprise pour commencer à utiliser Factur-IA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/company"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Configurer mon entreprise
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground">{t('auth.subtitle')}</p>
      </div>

      {/* Alertes factures en retard */}
      {overdueInvoices.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">
                {overdueInvoices.length} facture{overdueInvoices.length > 1 ? 's' : ''} en retard
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueInvoices.slice(0, 3).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between text-sm">
                  <Link href={`/invoices/${invoice.id}`} className="hover:underline">
                    <span className="font-medium">{invoice.number}</span>
                    <span className="text-muted-foreground"> - {invoice.client?.name}</span>
                  </Link>
                  <span className="font-medium">{formatCurrency(invoice.total_ttc)}</span>
                </div>
              ))}
              {overdueInvoices.length > 3 && (
                <Link href="/invoices?status=overdue" className="text-sm text-primary hover:underline">
                  Voir toutes les factures en retard
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques principales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.revenue')}</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.revenueThisMonth || 0)}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.thisMonth')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Annuel</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.revenueThisYear || 0)}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.thisYear')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.pending')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSent || 0}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats?.totalPendingAmount || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.overdue')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.totalOverdue || 0}</div>
            <p className="text-xs text-muted-foreground">{t('invoices.title')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Résumé des factures */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Brouillons</span>
              </div>
              <span className="text-xl font-semibold">{stats?.totalDraft || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Envoyées</span>
              </div>
              <span className="text-xl font-semibold">{stats?.totalSent || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Payées</span>
              </div>
              <span className="text-xl font-semibold">{stats?.totalPaid || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total</span>
              </div>
              <span className="text-xl font-semibold">{stats?.totalInvoices || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Factures récentes et Top clients */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentInvoices')}</CardTitle>
            <CardDescription>Les 5 dernières factures créées</CardDescription>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune facture pour le moment.</p>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => {
                  const status = statusConfig[invoice.status]
                  return (
                    <div key={invoice.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="font-medium hover:underline"
                        >
                          {invoice.number}
                        </Link>
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(invoice.total_ttc)}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.client?.name}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <Link
                  href="/invoices"
                  className="block text-sm text-primary hover:underline mt-4"
                >
                  Voir toutes les factures
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.topClients')}</CardTitle>
            <CardDescription>Par chiffre d'affaires</CardDescription>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun client avec factures payées.</p>
            ) : (
              <div className="space-y-3">
                {topClients.map(({ client, totalTtc, invoiceCount }) => (
                  <div key={client.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{client.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(totalTtc)}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoiceCount} facture{invoiceCount > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ))}
                <Link
                  href="/clients"
                  className="block text-sm text-primary hover:underline mt-4"
                >
                  Voir tous les clients
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
