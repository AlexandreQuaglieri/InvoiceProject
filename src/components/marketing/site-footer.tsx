import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Receipt } from 'lucide-react'
import { SARat } from '@/components/brand/street-art'

/** Pied de page public — RSC pur. */
export function SiteFooter() {
  const t = useTranslations('landing.footer')

  const links = [
    { href: '/legal/cgu', label: t('links.cgu') },
    { href: '/legal/confidentialite', label: t('links.privacy') },
    { href: '/legal/mentions-legales', label: t('links.mentions') },
  ]

  return (
    <footer className="relative border-t">
      <div className="mx-auto w-full max-w-6xl px-5 pb-12 pt-9 sm:px-7">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-2 text-[15px] font-bold text-foreground">
            <Receipt className="size-[18px]" aria-hidden="true" />
            {t('brand')}
          </span>
          <span>{t('copyright')}</span>
          <nav className="flex gap-4 sm:ml-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-sm underline-offset-[3px] transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-3.5 max-w-[60ch] text-xs italic text-muted-foreground">{t('quip')}</p>
      </div>
      <SARat
        flip
        size={86}
        className="pointer-events-none absolute bottom-3 right-7 hidden select-none text-foreground opacity-75 sm:block"
      />
    </footer>
  )
}
