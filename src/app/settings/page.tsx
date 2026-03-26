import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { MCPTokens } from '@/components/settings/mcp-tokens'
import { ChorusProSettings } from '@/components/settings/chorus-pro-settings'
import { getMCPTokens } from '@/actions/mcp-tokens'
import { getUserSettings } from '@/actions/settings'

export default async function SettingsPage() {
  const t = await getTranslations()
  const mcpTokens = await getMCPTokens()
  const userSettings = await getUserSettings()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-muted-foreground">Gérez vos préférences et paramètres.</p>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">{t('settings.general')}</TabsTrigger>
            <TabsTrigger value="invoicing">{t('settings.invoicing')}</TabsTrigger>
            <TabsTrigger value="api">{t('settings.api')}</TabsTrigger>
            <TabsTrigger value="mcp">Claude MCP</TabsTrigger>
            <TabsTrigger value="chorus">Chorus Pro</TabsTrigger>
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

          <TabsContent value="chorus" className="space-y-4">
            <ChorusProSettings
              initialValues={{
                chorus_pro_client_id: userSettings?.chorus_pro_client_id,
                chorus_pro_client_secret: userSettings?.chorus_pro_client_secret,
                chorus_pro_login: userSettings?.chorus_pro_login,
                chorus_pro_password: userSettings?.chorus_pro_password,
                chorus_pro_sandbox: userSettings?.chorus_pro_sandbox,
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
