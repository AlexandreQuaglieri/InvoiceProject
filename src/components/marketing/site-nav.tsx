import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocaleToggle } from '@/components/layout/locale-toggle'
import { ThemeToggle } from '@/components/theme/theme-toggle'

/**
 * Barre de navigation publique (landing + pages légales).
 * RSC pur : aucun accès Supabase, uniquement de l'i18n et des liens.
 */
export function SiteNav() {
  const t = useTranslations('landing.nav')

  const links = [
    { href: '/#methodes', label: t('links.methods') },
    { href: '/#claude', label: t('links.mcp') },
    { href: '/#reforme', label: t('links.reform') },
    { href: '/#studio', label: t('links.studio') },
  ]

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-[62px] w-full max-w-6xl items-center gap-6 px-5 sm:px-7">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-[17px] font-bold tracking-tight"
        >
          <Receipt className="size-5" aria-hidden="true" />
          {t('brand')}
        </Link>
        <div className="ml-2 hidden items-center gap-5 text-[13.5px] text-muted-foreground md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <LocaleToggle />
          <ThemeToggle />
          <Button asChild size="sm" className="ml-1.5">
            <Link href="/signup">{t('cta')}</Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}
