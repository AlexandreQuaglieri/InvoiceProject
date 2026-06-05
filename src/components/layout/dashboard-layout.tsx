import { redirect } from 'next/navigation'
import { getUser } from '@/actions/auth'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { AICopilotPanel } from '@/components/chat/ai-copilot-panel'
import { createClient } from '@/lib/supabase/server'
import { getPdpConnection } from '@/lib/pdp'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()
  const pdpConnected = (await getPdpConnection(supabase, user.id)).connected

  return (
    <SidebarProvider>
      <AppSidebar pdpConnected={pdpConnected} />
      <SidebarInset className="flex flex-row h-svh overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <AppHeader user={user} />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
        <AICopilotPanel />
      </SidebarInset>
    </SidebarProvider>
  )
}
