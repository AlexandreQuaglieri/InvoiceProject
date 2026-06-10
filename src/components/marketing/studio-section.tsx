import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SAParachute } from '@/components/brand/street-art'

/** Le studio Quatools — pas de formulaire email, CTA direct vers /login. */
export function StudioSection() {
  const t = useTranslations('landing.studio')

  return (
    <section id="studio" className="scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-12 sm:px-7">
        <div className="relative grid items-center gap-10 rounded-[20px] border-[1.5px] border-border-strong bg-card p-7 text-card-foreground sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:px-14 lg:py-13">
          <SAParachute
            size={88}
            className="pointer-events-none absolute -top-[52px] right-12 hidden select-none text-foreground lg:block"
          />
          <div>
            <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground">
              {t('eyebrow')}
            </span>
            <h2 className="mb-3.5 mt-3 text-balance text-3xl font-bold leading-[1.12] tracking-tight md:text-4xl">
              {t('title')}
            </h2>
            <p className="text-pretty text-[15.5px] text-muted-foreground">
              {t.rich('body', {
                strong: (chunks) => (
                  <strong className="font-semibold text-foreground">{chunks}</strong>
                ),
              })}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="h-13 text-[15.5px]">
              <Link href="/login">
                <Send aria-hidden="true" />
                {t('cta')}
              </Link>
            </Button>
            <span className="text-[11.5px] text-muted-foreground">{t('note')}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
