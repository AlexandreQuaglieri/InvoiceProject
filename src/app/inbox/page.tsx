import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Inbox as InboxIcon } from 'lucide-react'
import { superPdpFromEnv, type PdpInboundInvoice } from '@/lib/pdp'

function formatDate(d: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(new Date(d))
}

function formatAmount(amount: number, currency?: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(amount)
}

export default async function InboxPage() {
  const pdp = superPdpFromEnv()
  let inbound: PdpInboundInvoice[] = []
  let error: string | null = null
  if (pdp) {
    try {
      inbound = await pdp.listInbound()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Erreur lors de la récupération'
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Factures reçues</h1>
          <p className="text-muted-foreground">
            Factures électroniques entrantes via la plateforme de dématérialisation (PDP).
          </p>
        </div>

        {!pdp ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              La PDP n&apos;est pas encore configurée sur la plateforme.
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : inbound.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <InboxIcon className="mb-3 h-10 w-10 opacity-50" />
              <p>Aucune facture reçue pour le moment.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{inbound.length} facture(s) reçue(s)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 text-left font-medium">Reçue le</th>
                      <th className="py-2 text-left font-medium">Émetteur</th>
                      <th className="py-2 text-left font-medium">N°</th>
                      <th className="py-2 text-right font-medium">Montant TTC</th>
                      <th className="py-2 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {inbound.map((inv) => (
                      <tr key={inv.depositId} className="border-b">
                        <td className="py-2">{formatDate(inv.receivedAt)}</td>
                        <td className="py-2">{inv.sellerName || inv.sellerVat || '—'}</td>
                        <td className="py-2">{inv.number || inv.externalId || '—'}</td>
                        <td className="py-2 text-right">
                          {inv.totalWithVat != null ? formatAmount(inv.totalWithVat, inv.currency) : '—'}
                        </td>
                        <td className="py-2 text-right">
                          <Button asChild variant="ghost" size="sm">
                            <a href={`/api/inbox/${inv.depositId}/download`}>
                              <Download className="mr-1 h-4 w-4" />
                              Télécharger
                            </a>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
