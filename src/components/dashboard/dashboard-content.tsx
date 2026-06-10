'use client'

// Dashboard 100% dérivé du store live (charte règles 1 & 2) : aucune stat
// stockée, tout est recalculé via src/lib/stats.ts à chaque event Realtime.
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Clock, AlertTriangle, FileText, Users, Euro, Send, CheckCircle } from 'lucide-react'
import { useLiveCompany, useLiveInvoices } from '@/lib/realtime'
import {
  computeInvoiceStats,
  recentInvoices as deriveRecentInvoices,
  overdueInvoices as deriveOverdueInvoices,
  topClients as deriveTopClients,
  effectiveStatus,
} from '@/lib/stats'
import type { InvoiceStatus } from '@/types/database'

const statusConfig: Record<InvoiceStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Brouillon', variant: 'secondary' },
  sent: { label: 'Envoyée', variant: 'default' },
  paid: { label: 'Payée', variant: 'default' },
  overdue: { label: 'En retard', variant: 'destructive' },
  cancelled: { label: 'Annulée', variant: 'outline' },
}

export function DashboardContent() {
  const t = useTranslations()
  const company = useLiveCompany()
  const invoices = useLiveInvoices()

  const stats = useMemo(() => computeInvoiceStats(invoices), [invoices])
  const recentInvoices = useMemo(() => deriveRecentInvoices(invoices, 5), [invoices])
  const overdueInvoices = useMemo(() => deriveOverdueInvoices(invoices), [invoices])
  const topClients = useMemo(() => deriveTopClients(invoices, 5), [invoices])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  // Le dashboard-gate garantit une entreprise configurée ; garde null-safe
  // silencieuse le temps d'un éventuel event Realtime transitoire.
  if (!company) return null

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
            <div className="text-2xl font-bold">{formatCurrency(stats.revenueThisMonth)}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.thisMonth')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Annuel</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.revenueThisYear)}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.thisYear')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.pending')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSent}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalPendingAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.overdue')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.totalOverdue}</div>
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
              <span className="text-xl font-semibold">{stats.totalDraft}</span>
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
              <span className="text-xl font-semibold">{stats.totalSent}</span>
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
              <span className="text-xl font-semibold">{stats.totalPaid}</span>
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
              <span className="text-xl font-semibold">{stats.totalInvoices}</span>
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
                  const status = statusConfig[effectiveStatus(invoice)]
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
            <CardDescription>Par chiffre d&apos;affaires</CardDescription>
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
