'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { submitLead } from '@/actions/leads'

type Props = {
  quizWho: 'indep' | 'tpe' | 'grande'
  quizBilling: 'b2b' | 'b2c' | 'mix'
}

// Capture d'email affichée sous le verdict du quiz réforme.
export function LeadCapture({ quizWho, quizBilling }: Props) {
  const t = useTranslations('landing.quiz.capture')
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await submitLead({
        email,
        quizWho,
        quizBilling,
        locale: locale === 'en' ? 'en' : 'fr',
      })
      if (result.success) {
        setStatus('success')
        if (posthog.__loaded) posthog.capture('lead_submitted', { source: 'quiz-reforme' })
      } else {
        setStatus('error')
        setErrorMessage(result.error ?? t('error'))
      }
    })
  }

  if (status === 'success') {
    return (
      <p
        role="status"
        className="mt-4 rounded-xl border border-dashed border-border-strong px-4 py-3.5 text-sm font-medium"
      >
        {t('success')}
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-border-strong p-4">
      <div className="mb-1 flex items-center gap-2 text-[14px] font-semibold">
        <Mail className="size-4" aria-hidden="true" />
        {t('title')}
      </div>
      <p className="mb-3 text-[13px] text-muted-foreground">{t('text')}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={pending}
          className={cn(
            'h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            pending ? 'opacity-60' : 'hover:opacity-90'
          )}
        >
          {pending ? t('sending') : t('submit')}
        </button>
      </div>
      {status === 'error' && (
        <p role="alert" className="mt-2 text-[12.5px] text-destructive">
          {errorMessage}
        </p>
      )}
      <p className="mt-2 text-[11.5px] text-muted-foreground">{t('privacy')}</p>
    </form>
  )
}
