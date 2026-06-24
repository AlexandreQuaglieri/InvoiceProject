'use client'

// Parcours d'onboarding SIMPLIFIÉ — IA-first, un seul chemin guidé par étape
// (plus de choix « IA / MCP / manuel » qui perdait l'utilisateur). Avancement
// 100 % DÉRIVÉ (charte règle 1) :
//   1. Entreprise   ✓ === company !== null              (IA : « donne-moi ton Kbis »)
//   2. Facture élec ✓ === raccordement PDP (pdpConnected) (activable ou « plus tard »)
//   3. Premier client ✓ === clients.length > 0           (IA + branche ton assistant LLM)
// La page ne montre QUE l'étape en cours : aucune section annexe à parcourir.
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, Check, CheckCircle2, Lock, ShieldCheck } from 'lucide-react'

import { AiPanel } from './ai-panel'
import { ManualPanel } from './manual-panel'
import { McpPanel } from './mcp-panel'
import { PanelShell } from './panel-shell'
import { OnboardingCompletion } from './completion'
import { ONBOARDING_STEPS, type ExtractStep, type OnboardingStep } from './types'
import { useLiveClients, useLiveCompany } from '@/lib/realtime'
import { ActivatePdpButton } from '@/components/invoices/activate-pdp-button'
import { Button } from '@/components/ui/button'
import { SAPlane } from '@/components/brand/street-art'
import { cn } from '@/lib/utils'

interface OnboardingFlowProps {
  // Raccordement PDP (user_settings.pdp_connected_at) — hors store live, fourni
  // par le RSC. Une connexion PDP passe par un redirect : le RSC se rerend.
  pdpConnected: boolean
  // Acceptation des CGU (gérée optimiste par le dashboard-gate).
  onAccept: () => void
}

export function OnboardingFlow({ pdpConnected, onAccept }: OnboardingFlowProps) {
  const t = useTranslations('onboarding')
  const company = useLiveCompany()
  const clients = useLiveClients()

  // États dérivés — jamais stockés.
  const done: Record<OnboardingStep, boolean> = {
    company: company !== null,
    einvoicing: pdpConnected,
    client: clients.length > 0,
  }

  // États de session (non dérivables) : repli manuel, e-invoicing reporté, fin anticipée.
  const [manualStep, setManualStep] = useState<ExtractStep | null>(null)
  const [skipEInvoicing, setSkipEInvoicing] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const currentStep: OnboardingStep | null = !done.company
    ? 'company'
    : !done.einvoicing && !skipEInvoicing
      ? 'einvoicing'
      : !done.client
        ? 'client'
        : null

  // Terminal : tout est fait, ou l'utilisateur choisit de terminer maintenant.
  if (finishing || currentStep === null) {
    return <OnboardingCompletion onAccept={onAccept} eInvoicingActive={done.einvoicing} />
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Bienvenue */}
      <header className="relative mb-7">
        <SAPlane
          size={150}
          className="pointer-events-none absolute -top-4 right-1 hidden text-foreground opacity-15 lg:block"
        />
        <h1 className="text-3xl font-bold tracking-tight">{t('welcome.title')}</h1>
        <p className="mt-1.5 max-w-[60ch] text-[15px] text-muted-foreground">
          {t('welcome.subtitle')}
        </p>
      </header>

      <Stepper done={done} currentStep={currentStep} />

      {/* Étape courante — un seul chemin guidé */}
      <section aria-labelledby="onboarding-step-heading">
        <div className="mb-4 mt-2">
          <h2 id="onboarding-step-heading" className="text-lg font-semibold tracking-tight">
            {t(`headings.${currentStep}.title`)}
          </h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {t(`headings.${currentStep}.subtitle`)}
          </p>
        </div>

        {currentStep === 'company' &&
          (manualStep === 'company' ? (
            <ManualPanel step="company" onClose={() => setManualStep(null)} />
          ) : (
            <AiPanel step="company" onManualFallback={() => setManualStep('company')} />
          ))}

        {currentStep === 'einvoicing' && <EInvoicingStep onSkip={() => setSkipEInvoicing(true)} />}

        {currentStep === 'client' && (
          <div className="space-y-4">
            {manualStep === 'client' ? (
              <ManualPanel step="client" onClose={() => setManualStep(null)} />
            ) : (
              <AiPanel step="client" onManualFallback={() => setManualStep('client')} />
            )}
            <ConnectAssistant />
          </div>
        )}
      </section>

      {/* Dès l'entreprise créée : on peut terminer sans être forcé de créer client/facture. */}
      {done.company && <FinishBar onFinish={() => setFinishing(true)} />}

      <Reassure />
    </div>
  )
}

/* ===================== Étape 2 — Facture électronique ===================== */

function EInvoicingStep({ onSkip }: { onSkip: () => void }) {
  const t = useTranslations('onboarding')
  const benefits = ['compliance', 'receive', 'automatic'] as const

  return (
    <PanelShell
      icon={ShieldCheck}
      title={t('einvoicing.title')}
      subtitle={t('einvoicing.subtitle')}
    >
      <div className="space-y-5">
        <ul className="space-y-2.5">
          {benefits.map((key) => (
            <li key={key} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{t(`einvoicing.benefits.${key}`)}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <ActivatePdpButton label={t('einvoicing.activate')} />
          <Button type="button" variant="ghost" onClick={onSkip}>
            {t('einvoicing.later')}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{t('einvoicing.laterHint')}</p>
      </div>
    </PanelShell>
  )
}

/* ===================== Étape 3 — Brancher l'assistant ===================== */

function ConnectAssistant() {
  const t = useTranslations('onboarding')
  return (
    <div>
      <div className="my-1 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('client.or')}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <McpPanel step="client" />
    </div>
  )
}

/* ===================== Barre « Terminer » ===================== */

function FinishBar({ onFinish }: { onFinish: () => void }) {
  const t = useTranslations('onboarding')
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-3 sm:flex-row sm:justify-between">
      <p className="text-[13px] text-muted-foreground">{t('finish.hint')}</p>
      <Button type="button" variant="outline" onClick={onFinish} className="shrink-0">
        {t('finish.cta')}
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

/* ===================== Stepper ===================== */

function Stepper({
  done,
  currentStep,
}: {
  done: Record<OnboardingStep, boolean>
  currentStep: OnboardingStep
}) {
  const t = useTranslations('onboarding')

  return (
    <div role="list" aria-label={t('stepper.label')} className="mb-8 mt-5 flex items-center">
      {ONBOARDING_STEPS.map((step, index) => {
        const state = done[step] ? 'done' : step === currentStep ? 'current' : 'upcoming'
        return (
          <div key={step} className={cn('flex items-center', index > 0 && 'flex-1')}>
            {index > 0 && (
              <div className="relative mx-3.5 h-px min-w-6 flex-1 overflow-hidden bg-border">
                <div
                  className={cn(
                    'absolute inset-0 bg-foreground transition-[width] duration-300',
                    done[ONBOARDING_STEPS[index - 1]] ? 'w-full' : 'w-0'
                  )}
                />
              </div>
            )}
            <div
              role="listitem"
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex items-center gap-3"
            >
              <span
                className={cn(
                  'flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-card text-[13px] font-semibold',
                  state === 'done' && 'border-primary bg-primary text-primary-foreground',
                  state === 'current' && 'border-foreground ring-4 ring-foreground/10',
                  state === 'upcoming' && 'text-muted-foreground'
                )}
              >
                {state === 'done' ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">{t('stepper.done')}</span>
                  </>
                ) : (
                  index + 1
                )}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {t(`stepper.steps.${step}.kicker`)}
                </span>
                <span
                  className={cn(
                    'text-[13.5px] font-semibold',
                    state === 'upcoming' && 'font-medium text-muted-foreground'
                  )}
                >
                  {t(`stepper.steps.${step}.title`)}
                </span>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ===================== Réassurance ===================== */

function Reassure() {
  const t = useTranslations('onboarding')
  const strong = (chunks: React.ReactNode) => (
    <strong className="font-semibold text-foreground">{chunks}</strong>
  )

  return (
    <footer className="mt-7 flex flex-wrap items-center gap-4 rounded-xl border bg-muted/40 px-4.5 py-3.5">
      <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t.rich('reassure.compliance', { strong })}</span>
      </span>
      <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
      <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t.rich('reassure.data', { strong })}</span>
      </span>
    </footer>
  )
}
