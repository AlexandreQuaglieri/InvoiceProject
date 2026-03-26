import { redirect } from 'next/navigation'
import { getUser } from '@/actions/auth'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { AICopilotPanel } from '@/components/chat/ai-copilot-panel'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <SidebarProvider>
      <AppSidebar />
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
