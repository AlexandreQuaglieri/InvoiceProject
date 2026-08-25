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
  Send,
  ClipboardList,
  Sparkles,
  Inbox,
  BarChart3,
  Plug,
  Lock,
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
import { useLiveCompany } from '@/lib/realtime'

export function AppSidebar({ pdpConnected = false }: { pdpConnected?: boolean }) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const tCommon = useTranslations('common')

  // Verrouillage dérivé (charte règle 1) : tant que l'entreprise n'est pas
  // configurée, tout est verrouillé sauf le tableau de bord (qui porte
  // l'onboarding). Realtime déverrouille sans refresh dès la création.
  const company = useLiveCompany()
  const locked = company === null

  const menuItems = [
    {
      title: t('dashboard'),
      url: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: t('aiAssistant'),
      url: '/chat',
      icon: Sparkles,
    },
    {
      title: t('invoices'),
      url: '/invoices',
      icon: FileText,
    },
    {
      title: t('inbox'),
      url: '/inbox',
      icon: Inbox,
    },
    {
      title: t('ereporting'),
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
          <Send className="h-6 w-6" />
          <span className="font-bold text-lg">{tCommon('appName')}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('menu')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isLocked = locked && item.url !== '/dashboard'
                return (
                  <SidebarMenuItem key={item.url}>
                    {isLocked ? (
                      <SidebarMenuButton
                        aria-disabled="true"
                        title={t('locked')}
                        className="cursor-not-allowed text-muted-foreground/60 hover:bg-transparent hover:text-muted-foreground/60 active:bg-transparent active:text-muted-foreground/60"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        <Lock className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url || pathname.startsWith(item.url + '/')}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4 space-y-3">
        {!pdpConnected && !locked && (
          <div className="space-y-1.5">
            <a
              href="/api/pdp/connect"
              className="flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plug className="h-4 w-4" />
              {t('activateEInvoicing')}
            </a>
            <p className="text-center text-[10px] leading-snug text-muted-foreground">
              {t('pdpRedirectNotice')}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center">
          {tCommon('appName')} v0.1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
