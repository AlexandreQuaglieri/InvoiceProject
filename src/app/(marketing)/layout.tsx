import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'

/**
 * Layout des surfaces publiques (landing + pages légales).
 * RSC pur : aucun accès Supabase — la redirection des utilisateurs connectés
 * vers /dashboard est gérée par le middleware.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
