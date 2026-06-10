'use client'

// Écran de complétion : récap 100 % DÉRIVÉ du store live (entreprise, premier
// client, première facture) + consent gate CGU/confidentialité. L'acceptation
// optimiste est gérée par le dashboard-gate via onAccept().
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Check, ChevronRight, LayoutDashboard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useLiveClients, useLiveCompany, useLiveInvoices } from '@/lib/realtime'
import { SAParachute, SARat } from '@/components/brand/street-art'
import { cn } from '@/lib/utils'

interface OnboardingCompletionProps {
  onAccept: () => void
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)

export function OnboardingCompletion({ onAccept }: OnboardingCompletionProps) {
  const t = useTranslations('onboarding')
  const company = useLiveCompany()
  const clients = useLiveClients()
  const invoices = useLiveInvoices()
  const [consent, setConsent] = useState(false)

  // Premier client / première facture = les plus anciens (dérivé, jamais stocké).
  const firstClient = useMemo(
    () => [...clients].sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null,
    [clients]
  )
  const firstInvoice = useMemo(
    () => [...invoices].sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null,
    [invoices]
  )

  const recap: Array<{ key: string; label: string; detail: string | null }> = [
    { key: 'company', label: company?.name ?? '', detail: t('completion.recap.company') },
    { key: 'client', label: firstClient?.name ?? '', detail: t('completion.recap.client') },
    {
      key: 'invoice',
      label: firstInvoice
        ? `${firstInvoice.number} · ${formatCurrency(firstInvoice.total_ttc)}`
        : '',
      detail: t('completion.recap.invoice'),
    },
  ]

  return (
    <div className="relative mx-auto max-w-xl px-2 py-8 text-center">
      <SAParachute
        size={82}
        className="pointer-events-none absolute -top-1 right-0 hidden text-foreground opacity-85 md:block"
      />
      <SARat
        size={105}
        flip
        className="pointer-events-none absolute -bottom-4 -left-6 hidden text-foreground opacity-80 md:block"
      />

      {/* Seal animé */}
      <div
        aria-hidden="true"
        className="mx-auto mb-6 flex h-19 w-19 items-center justify-center rounded-full bg-primary text-primary-foreground ring-8 ring-foreground/8 motion-safe:animate-[stamp_0.5s_cubic-bezier(0.16,1,0.3,1)_both]"
      >
        <Check className="h-9 w-9" strokeWidth={2.5} />
      </div>

      <h1 className="text-2xl font-bold tracking-tight">{t('completion.title')}</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">{t('completion.subtitle')}</p>

      {/* Récap dérivé du store */}
      <ul className="mx-auto mb-7 mt-7 flex max-w-sm flex-col gap-2 text-left">
        {recap.map((row) => (
          <li
            key={row.key}
            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-soft"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{row.label}</span>
              <span className="block text-xs text-muted-foreground">{row.detail}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </li>
        ))}
      </ul>

      {/* Consent gate */}
      <label
        className={cn(
          'mx-auto mb-6 flex max-w-md cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors',
          consent && 'border-foreground'
        )}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] border-border-strong/60 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
            consent && 'border-primary bg-primary text-primary-foreground'
          )}
        >
          {consent && <Check className="h-3.5 w-3.5" />}
        </span>
        <span className="text-xs leading-relaxed">
          {t.rich('completion.consent', {
            cgu: (chunks) => (
              <Link
                href="/legal/cgu"
                target="_blank"
                className="font-medium underline underline-offset-2 hover:text-muted-foreground"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link
                href="/legal/confidentialite"
                target="_blank"
                className="font-medium underline underline-offset-2 hover:text-muted-foreground"
              >
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      <Button
        type="button"
        size="lg"
        disabled={!consent}
        onClick={onAccept}
        title={consent ? undefined : t('completion.ctaHint')}
      >
        <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden="true" />
        {t('completion.cta')}
      </Button>
    </div>
  )
}
