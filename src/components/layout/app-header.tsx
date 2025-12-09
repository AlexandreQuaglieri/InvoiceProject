'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { LocaleToggle } from '@/components/layout/locale-toggle'
import { UserMenu } from '@/components/layout/user-menu'

interface AppHeaderProps {
  user: {
    email?: string
    user_metadata?: {
      full_name?: string
      avatar_url?: string
    }
  }
}

export function AppHeader({ user }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <LocaleToggle />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  )
}
