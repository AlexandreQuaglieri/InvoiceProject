// Layout persistant des pages authentifiées (route group, URLs inchangées).
// Charge l'état initial en RSC (zéro spinner) et seed le LiveStoreProvider :
// ensuite, Supabase Realtime + optimistic UI gardent la donnée vivante — les
// pages ne refetchent jamais (charte règle 2).
import { redirect } from 'next/navigation'
import { getUser } from '@/actions/auth'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { AICopilotPanel } from '@/components/chat/ai-copilot-panel'
import { createClient } from '@/lib/supabase/server'
import { getPdpConnection } from '@/lib/pdp'
import { LiveStoreProvider } from '@/lib/realtime'
import { getCompany } from '@/actions/company'
import { getClients } from '@/actions/clients'
import { getInvoices, markOverdueInvoices } from '@/actions/invoices'
import { getQuotes } from '@/actions/quotes'
import { getConversations } from '@/actions/conversations'
import { getInboundInvoices } from '@/actions/inbound'

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()
  const [pdpConnection, company] = await Promise.all([
    getPdpConnection(supabase, user.id),
    getCompany(),
  ])

  let initial = {
    company,
    clients: [] as Awaited<ReturnType<typeof getClients>>,
    invoices: [] as Awaited<ReturnType<typeof getInvoices>>,
    quotes: [] as Awaited<ReturnType<typeof getQuotes>>,
    conversations: [] as Awaited<ReturnType<typeof getConversations>>,
    inboundInvoices: [] as Awaited<ReturnType<typeof getInboundInvoices>>,
  }

  if (company) {
    // Normalise sent → overdue avant le paint, puis lectures en parallèle.
    await markOverdueInvoices()
    const [clients, invoices, quotes, conversations, inboundInvoices] = await Promise.all([
      getClients(),
      getInvoices(),
      getQuotes(),
      getConversations(),
      getInboundInvoices(),
    ])
    initial = { company, clients, invoices, quotes, conversations, inboundInvoices }
  }

  return (
    <LiveStoreProvider userId={user.id} companyId={company?.id ?? null} initial={initial}>
      <SidebarProvider>
        <AppSidebar pdpConnected={pdpConnection.connected} />
        <SidebarInset className="flex flex-row h-svh overflow-hidden">
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <AppHeader user={user} />
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </div>
          <AICopilotPanel />
        </SidebarInset>
      </SidebarProvider>
    </LiveStoreProvider>
  )
}
