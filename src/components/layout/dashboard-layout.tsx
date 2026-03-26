import { redirect } from 'next/navigation'
import { getUser } from '@/actions/auth'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { FloatingChatWidget } from '@/components/chat/floating-chat-widget'

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
      <SidebarInset>
        <AppHeader user={user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
      <FloatingChatWidget />
    </SidebarProvider>
  )
}
