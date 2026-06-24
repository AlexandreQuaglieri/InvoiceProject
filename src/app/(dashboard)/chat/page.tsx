import { AIChat } from '@/components/chat/ai-chat'
import { getCompany } from '@/actions/company'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ChatPageProps {
  searchParams: Promise<{ conversation?: string }>
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = await searchParams
  const company = await getCompany()

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))]">
      <div className="flex-shrink-0 pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Assistant facturation</h1>
        <p className="text-muted-foreground">
          Créez des factures et devis en langage naturel.
        </p>
      </div>

      {!company ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuration requise</CardTitle>
            <CardDescription>
              Vous devez d&apos;abord configurer votre entreprise avant d&apos;utiliser l&apos;assistant.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <AIChat initialConversationId={params.conversation} />
      )}
    </div>
  )
}
