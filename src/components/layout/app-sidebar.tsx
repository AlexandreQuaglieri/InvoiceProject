'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  Settings,
  Receipt,
  ClipboardList,
  Sparkles,
  Inbox,
  BarChart3,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar'

export function AppSidebar() {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const tCommon = useTranslations('common')

  const menuItems = [
    {
      title: t('dashboard'),
      url: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Assistant IA',
      url: '/chat',
      icon: Sparkles,
    },
    {
      title: t('invoices'),
      url: '/invoices',
      icon: FileText,
    },
    {
      title: 'Factures reçues',
      url: '/inbox',
      icon: Inbox,
    },
    {
      title: 'E-reporting',
      url: '/e-reporting',
      icon: BarChart3,
    },
    {
      title: t('quotes'),
      url: '/quotes',
      icon: ClipboardList,
    },
    {
      title: t('clients'),
      url: '/clients',
      icon: Users,
    },
    {
      title: t('company'),
      url: '/company',
      icon: Building2,
    },
    {
      title: t('settings'),
      url: '/settings',
      icon: Settings,
    },
  ]

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          <span className="font-bold text-lg">{tCommon('appName')}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url || pathname.startsWith(item.url + '/')}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <p className="text-xs text-muted-foreground text-center">
          {tCommon('appName')} v0.1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
