import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SAPlane } from '@/components/brand/street-art'
import { HeroDemo } from '@/components/marketing/hero-demo'

/** Héro de la landing — RSC pur (la démo animée est un îlot client). */
export function HeroSection() {
  const t = useTranslations('landing.hero')

  const strong = (chunks: React.ReactNode) => (
    <strong className="font-semibold text-foreground">{chunks}</strong>
  )

  return (
    <header className="relative overflow-hidden">
      <SAPlane
        size={210}
        className="pointer-events-none absolute -right-2.5 top-10 select-none text-foreground opacity-10"
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-16 pt-16 sm:px-7 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-20">
        <div>
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground">
            {t('eyebrow')}
          </span>
          <h1 className="mb-5 mt-4 text-balance text-5xl font-extrabold leading-[1.04] tracking-[-0.03em] md:text-6xl">
            {t('title')}
          </h1>
          <p className="mb-7 max-w-[50ch] text-pretty text-[17px] text-muted-foreground">
            {t.rich('subtitle', { strong })}
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <Button asChild size="lg" className="h-12 px-7 text-[15px]">
              <Link href="/signup">
                <Send aria-hidden="true" />
                {t('ctaPrimary')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-7 text-[15px]">
              <a href="#reforme">{t('ctaSecondary')}</a>
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <span
              className="size-[7px] rounded-full bg-foreground motion-safe:animate-[blink_1.6s_ease-in-out_infinite]"
              aria-hidden="true"
            />
            <span>{t.rich('note', { strong })}</span>
          </div>
        </div>
        <HeroDemo />
      </div>
    </header>
  )
}
