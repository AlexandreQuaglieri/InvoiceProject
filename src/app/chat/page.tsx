import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { AIChat } from '@/components/chat/ai-chat'
import { getClients } from '@/actions/clients'
import { getCompany } from '@/actions/company'
import { getConversations } from '@/actions/conversations'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ChatPageProps {
  searchParams: Promise<{ conversation?: string }>
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = await searchParams
  const company = await getCompany()
  const clients = company ? await getClients() : []
  const conversations = company ? await getConversations() : []

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-theme(spacing.16))]">
        <div className="flex-shrink-0 pb-4">
          <h1 className="text-3xl font-bold tracking-tight">Assistant IA</h1>
          <p className="text-muted-foreground">
            Créez des factures et devis en langage naturel.
          </p>
        </div>

        {!company ? (
          <Card>
            <CardHeader>
              <CardTitle>Configuration requise</CardTitle>
              <CardDescription>
                Vous devez d'abord configurer votre entreprise avant d'utiliser l'assistant.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <AIChat
            clients={clients}
            conversations={conversations}
            initialConversationId={params.conversation}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
