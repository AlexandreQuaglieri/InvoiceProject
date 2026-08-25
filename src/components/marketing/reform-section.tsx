import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Zap } from 'lucide-react'
import { ReformQuiz } from '@/components/marketing/reform-quiz'

/** Réforme 2026 sans jargon : 3 points + mythe + quiz interactif — RSC pur. */
export function ReformSection({ showPageLink = false }: { showPageLink?: boolean }) {
  const t = useTranslations('landing.reform')

  const strong = (chunks: React.ReactNode) => (
    <strong className="font-semibold">{chunks}</strong>
  )

  const points = [
    { n: '1', key: 'point1' },
    { n: '2', key: 'point2' },
    { n: '3', key: 'point3' },
  ] as const

  return (
    <section id="reforme" className="scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-7">
        <div className="mb-11 max-w-2xl">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground">
            {t('eyebrow')}
          </span>
          <h2 className="mt-3.5 text-balance text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
            {t('title')}
          </h2>
        </div>
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-5.5">
            {points.map((point) => (
              <div key={point.n} className="flex gap-4">
                <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-border-strong font-mono text-[13px] font-semibold">
                  {point.n}
                </span>
                <p className="pt-1 text-pretty text-[15.5px]">
                  {t.rich(point.key, { strong })}
                </p>
              </div>
            ))}
            <p className="mt-1.5 flex items-start gap-2.5 rounded-xl border border-dashed border-border-strong px-4 py-3.5 text-[13.5px] leading-normal text-muted-foreground">
              <Zap className="mt-0.5 size-3.5 shrink-0 text-foreground" aria-hidden="true" />
              <span>
                {t.rich('myth', {
                  strong: (chunks) => (
                    <strong className="font-semibold text-foreground">{chunks}</strong>
                  ),
                })}
              </span>
            </p>
          </div>
          <div>
            <ReformQuiz />
            {showPageLink && (
              <Link
                href="/suis-je-concerne-2026"
                className="mt-3 inline-block rounded-sm text-[12.5px] text-muted-foreground underline underline-offset-[3px] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('pageLink')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
