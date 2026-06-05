import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { MCPTokens } from '@/components/settings/mcp-tokens'
import { getMCPTokens } from '@/actions/mcp-tokens'
import { WalletConnect } from '@/components/settings/wallet-connect'
import { PdpConnect } from '@/components/settings/pdp-connect'
import { getPdpConnection } from '@/lib/pdp'
import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; pdp?: string }>
}) {
  const sp = await searchParams
  const t = await getTranslations()
  const mcpTokens = await getMCPTokens()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const pdpConnection = user
    ? await getPdpConnection(supabase, user.id)
    : { connected: false }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-muted-foreground">Gérez vos préférences et paramètres.</p>
        </div>

        <Tabs defaultValue={sp.tab ?? 'general'} className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">{t('settings.general')}</TabsTrigger>
            <TabsTrigger value="invoicing">{t('settings.invoicing')}</TabsTrigger>
            <TabsTrigger value="einvoicing">Facturation élec.</TabsTrigger>
            <TabsTrigger value="api">{t('settings.api')}</TabsTrigger>
            <TabsTrigger value="mcp">Claude MCP</TabsTrigger>
            <TabsTrigger value="wallet">Data Wallet</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.general')}</CardTitle>
                <CardDescription>Langue, thème et préférences générales.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t('settings.language')}</label>
                  <p className="text-sm text-muted-foreground">
                    Changez la langue avec le bouton dans la barre de navigation.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('settings.theme')}</label>
                  <p className="text-sm text-muted-foreground">
                    Changez le thème avec le bouton dans la barre de navigation.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoicing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.invoicing')}</CardTitle>
                <CardDescription>Préfixe et numérotation des factures.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t('settings.invoicePrefix')}</label>
                  <p className="text-sm text-muted-foreground">FAC</p>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('settings.nextInvoiceNumber')}</label>
                  <p className="text-sm text-muted-foreground">1</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.api')}</CardTitle>
                <CardDescription>{t('settings.claudeApiKeyHelp')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="text-sm font-medium">{t('settings.claudeApiKey')}</label>
                  <p className="text-sm text-muted-foreground">
                    Aucune clé API configurée. Les fonctionnalités IA utiliseront la clé de la plateforme.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mcp" className="space-y-4">
            <MCPTokens tokens={mcpTokens} />
          </TabsContent>

          <TabsContent value="wallet" className="space-y-4">
            <WalletConnect userId={user?.id ?? ''} />
          </TabsContent>

          <TabsContent value="einvoicing" className="space-y-4">
            <PdpConnect connection={pdpConnection} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
