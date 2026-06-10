'use client'

// Liste clients branchée sur le store live (charte règle 2) : la page RSC ne
// fetch plus rien, Realtime + optimistic gardent la liste vivante.
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientDialog } from '@/components/clients/client-dialog'
import { ClientsTable } from '@/components/clients/clients-table'
import { useLiveCompany, useLiveClients } from '@/lib/realtime'

export function ClientsContent() {
  const t = useTranslations()
  const company = useLiveCompany()
  const clients = useLiveClients()

  if (!company) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('clients.title')}</h1>
          <p className="text-muted-foreground">Gérez vos clients et leurs informations.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('common.setupRequired')}</CardTitle>
            <CardDescription>{t('common.setupRequiredClients')}</CardDescription>
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
          <ClientsTable />
        </CardContent>
      </Card>
    </div>
  )
}
