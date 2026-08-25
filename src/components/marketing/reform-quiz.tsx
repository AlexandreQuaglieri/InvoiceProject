'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { cn } from '@/lib/utils'
import { LeadCapture } from '@/components/marketing/lead-capture'

/**
 * Quiz « Suis-je concerné ? » — état local pur, verdict 100 % dérivé des deux
 * réponses (9 combinaisons, clés i18n landing.quiz.verdict.*).
 */

type Who = 'indep' | 'tpe' | 'grande'
type Billing = 'b2b' | 'b2c' | 'mix'

const WHO_OPTIONS: Who[] = ['indep', 'tpe', 'grande']
const BILLING_OPTIONS: Billing[] = ['b2b', 'b2c', 'mix']

export function ReformQuiz() {
  const t = useTranslations('landing.quiz')
  const [who, setWho] = useState<Who | null>(null)
  const [billing, setBilling] = useState<Billing | null>(null)

  useEffect(() => {
    if (who && billing && posthog.__loaded) {
      posthog.capture('quiz_completed', { who, billing })
    }
  }, [who, billing])

  const optionClass = (selected: boolean) =>
    cn(
      'rounded-full border px-3.5 py-2 text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      selected
        ? 'border-border-strong bg-primary text-primary-foreground'
        : 'bg-background hover:border-border-strong'
    )

  return (
    <div className="rounded-2xl border-[1.5px] border-border-strong bg-card p-6 text-card-foreground shadow-[6px_6px_0_0_var(--border-strong)]">
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {t('label')}
      </div>
      <h3 className="mb-4 text-[19px] font-bold tracking-tight">{t('title')}</h3>

      <div className="mb-2.5 mt-3.5 text-[14.5px] font-semibold">{t('q1')}</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('q1')}>
        {WHO_OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={who === value}
            onClick={() => setWho(value)}
            className={optionClass(who === value)}
          >
            {t(`who.${value}`)}
          </button>
        ))}
      </div>

      <div className="mb-2.5 mt-4 text-[14.5px] font-semibold">{t('q2')}</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('q2')}>
        {BILLING_OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={billing === value}
            onClick={() => setBilling(value)}
            className={optionClass(billing === value)}
          >
            {t(`billing.${value}`)}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {who && billing && (
          <div
            key={`${who}-${billing}`}
            className="mt-5 rounded-xl bg-muted px-4 py-4 text-sm leading-relaxed motion-safe:animate-[reveal_0.4s_cubic-bezier(0.16,1,0.3,1)]"
          >
            {t.rich(`verdict.${who}_${billing}`, {
              strong: (chunks) => <strong className="font-bold">{chunks}</strong>,
            })}
          </div>
        )}
      </div>

      {who && billing && <LeadCapture quizWho={who} quizBilling={billing} />}

      {who && billing && (
        <button
          type="button"
          onClick={() => {
            setWho(null)
            setBilling(null)
          }}
          className="mt-3 rounded-sm text-[12.5px] text-muted-foreground underline underline-offset-[3px] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('reset')}
        </button>
      )}
    </div>
  )
}
