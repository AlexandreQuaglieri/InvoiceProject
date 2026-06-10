import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { superPdpForRequest, type PdpEReporting } from '@/lib/pdp'

const kindLabel = (k: string) =>
  k === 'transaction' ? 'Transactions' : k === 'payment' ? 'Paiements' : k
const roleLabel = (r: string) => (r === 'SE' ? 'Vendeur' : r === 'BY' ? 'Acheteur' : r)

export default async function EReportingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const pdp = user ? await superPdpForRequest(supabase, user.id) : null
  let items: PdpEReporting[] = []
  let error: string | null = null
  if (pdp) {
    try {
      items = await pdp.listEReportings()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Erreur lors de la récupération'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">E-reporting</h1>
        <p className="text-muted-foreground">
          Déclaration des transactions B2C et des paiements à l&apos;administration via la PDP.
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
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <BarChart3 className="mb-3 h-10 w-10 opacity-50" />
            <p>Aucune période d&apos;e-reporting pour le moment.</p>
            <p className="mt-1 text-xs">
              Les ventes B2C déclarées (depuis une facture à un particulier) y seront agrégées.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{items.length} période(s)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium">Type</th>
                    <th className="py-2 text-left font-medium">Rôle</th>
                    <th className="py-2 text-left font-medium">Période</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="py-2">{kindLabel(e.kind)}</td>
                      <td className="py-2">{roleLabel(e.roleCode)}</td>
                      <td className="py-2">
                        {e.startPeriod} → {e.endPeriod}
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
  )
}
