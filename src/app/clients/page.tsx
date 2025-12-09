import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ClientDialog } from '@/components/clients/client-dialog'
import { ClientsTable } from '@/components/clients/clients-table'
import { getClients } from '@/actions/clients'
import { getCompany } from '@/actions/company'

export default async function ClientsPage() {
  const company = await getCompany()
  const clients = company ? await getClients() : []

  return (
    <DashboardLayout>
      <ClientsContent clients={clients} hasCompany={!!company} />
    </DashboardLayout>
  )
}

function ClientsContent({
  clients,
  hasCompany,
}: {
  clients: Awaited<ReturnType<typeof getClients>>
  hasCompany: boolean
}) {
  const t = useTranslations()

  if (!hasCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('clients.title')}</h1>
          <p className="text-muted-foreground">Gérez vos clients et leurs informations.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuration requise</CardTitle>
            <CardDescription>
              Vous devez d'abord configurer votre entreprise avant de pouvoir ajouter des clients.
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
          <h1 className="text-3xl font-bold tracking-tight">{t('clients.title')}</h1>
          <p className="text-muted-foreground">
            {clients.length} client{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ClientDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('clients.title')}</CardTitle>
          <CardDescription>Liste de tous vos clients.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsTable clients={clients} />
        </CardContent>
      </Card>
    </div>
  )
}
