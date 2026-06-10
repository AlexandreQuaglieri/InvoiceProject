'use client'

// Parcours d'onboarding 3 étapes. L'avancement est 100 % DÉRIVÉ du store live
// (charte règle 1) : entreprise ✓ === company !== null, client ✓ === 1er client,
// facture ✓ === 1re facture. Toute écriture (formulaire, IA, MCP/Claude) fait
// avancer la page via Realtime/write-through, sans refresh.
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  BarChart3,
  BellRing,
  Check,
  Coffee,
  FileCheck,
  Lock,
  MessageSquare,
  PenLine,
  Plug,
  Scale,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { MethodCard } from './method-card'
import { AiPanel } from './ai-panel'
import { McpPanel } from './mcp-panel'
import { ManualPanel } from './manual-panel'
import { ONBOARDING_STEPS, type OnboardingMethod, type OnboardingStep } from './types'
import { useLiveClients, useLiveCompany, useLiveInvoices } from '@/lib/realtime'
import { SAPigeon, SAPlane } from '@/components/brand/street-art'
import { cn } from '@/lib/utils'

const METHOD_ICONS: Record<OnboardingMethod, LucideIcon> = {
  ai: Sparkles,
  mcp: Plug,
  manual: PenLine,
}

export function OnboardingFlow() {
  const t = useTranslations('onboarding')
  const company = useLiveCompany()
  const clients = useLiveClients()
  const invoices = useLiveInvoices()

  // États dérivés — jamais stockés.
  const done: Record<OnboardingStep, boolean> = {
    company: company !== null,
    client: clients.length > 0,
    invoice: invoices.length > 0,
  }
  const currentStep: OnboardingStep = !done.company ? 'company' : !done.client ? 'client' : 'invoice'

  // Panneau ouvert : mémorisé avec son étape pour se refermer tout seul quand
  // l'étape avance (sélection dérivée, pas d'effet de synchronisation).
  const [openPanel, setOpenPanel] = useState<{
    step: OnboardingStep
    method: OnboardingMethod
  } | null>(null)
  const selectedMethod = openPanel?.step === currentStep ? openPanel.method : null

  const toggleMethod = (method: OnboardingMethod) => {
    setOpenPanel(selectedMethod === method ? null : { step: currentStep, method })
  }
  const closePanel = () => setOpenPanel(null)

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

      {/* Étape courante */}
      <section aria-labelledby="onboarding-step-heading">
        <div className="mb-4 mt-2">
          <h2 id="onboarding-step-heading" className="text-lg font-semibold tracking-tight">
            {t(`headings.${currentStep}.title`)}
          </h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {t(`headings.${currentStep}.subtitle`)}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[880px]:grid-cols-[1.25fr_1fr_1fr]">
          <MethodCard
            icon={METHOD_ICONS.ai}
            title={t('methods.ai.title')}
            badge={{ label: t('methods.ai.badge'), variant: 'solid' }}
            tag={t('methods.ai.tag')}
            description={t(`methods.ai.desc.${currentStep}`)}
            time={t('methods.ai.time')}
            cta={t(`methods.ai.cta.${currentStep}`)}
            hero
            selected={selectedMethod === 'ai'}
            onSelect={() => toggleMethod('ai')}
          />
          <MethodCard
            icon={METHOD_ICONS.mcp}
            title={t('methods.mcp.title')}
            badge={{ label: t('methods.mcp.badge'), variant: 'ghost' }}
            tag={t('methods.mcp.tag')}
            description={t(`methods.mcp.desc.${currentStep}`)}
            time={t('methods.mcp.time')}
            cta={t(`methods.mcp.cta.${currentStep}`)}
            selected={selectedMethod === 'mcp'}
            onSelect={() => toggleMethod('mcp')}
          />
          <MethodCard
            icon={METHOD_ICONS.manual}
            title={t('methods.manual.title')}
            tag={t('methods.manual.tag')}
            description={t(`methods.manual.desc.${currentStep}`)}
            time={t('methods.manual.time')}
            cta={t(`methods.manual.cta.${currentStep}`)}
            selected={selectedMethod === 'manual'}
            onSelect={() => toggleMethod('manual')}
          />
        </div>

        {/* Panneau de la méthode choisie — un seul ouvert à la fois */}
        {selectedMethod === 'ai' && (
          <AiPanel
            step={currentStep}
            onClose={closePanel}
            onManualFallback={() => setOpenPanel({ step: currentStep, method: 'manual' })}
          />
        )}
        {selectedMethod === 'mcp' && <McpPanel step={currentStep} onClose={closePanel} />}
        {selectedMethod === 'manual' && <ManualPanel step={currentStep} onClose={closePanel} />}

        {!selectedMethod && (
          <p className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-[13px] text-muted-foreground">
            <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('hint')}</span>
          </p>
        )}
      </section>

      <DemoBlock />
      <NotDoBlock />
      <Reassure />
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

/* ===================== Ce que Factur-IA fait ===================== */

const DEMO_ITEMS: ReadonlyArray<{ key: string; icon: LucideIcon }> = [
  { key: 'compliance', icon: ShieldCheck },
  { key: 'quotes', icon: FileCheck },
  { key: 'assistant', icon: MessageSquare },
  { key: 'reminders', icon: BellRing },
]

function DemoBlock() {
  const t = useTranslations('onboarding')

  return (
    <section className="mt-11">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {t('demo.eyebrow')}
        </span>
        <span className="relative flex min-w-0 flex-1 items-center">
          <span className="h-px flex-1 bg-border" />
          <SAPigeon
            size={54}
            className="pointer-events-none absolute bottom-[calc(50%-3px)] right-8 text-foreground opacity-85"
          />
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3.5 min-[520px]:grid-cols-2 min-[880px]:grid-cols-4">
        {DEMO_ITEMS.map(({ key, icon: Icon }) => (
          <div
            key={key}
            className="flex flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <h4 className="text-[13.5px] font-semibold">{t(`demo.items.${key}.title`)}</h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t(`demo.items.${key}.desc`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ===================== Ce que Factur-IA ne fait PAS ===================== */

const NOTDO_ITEMS: ReadonlyArray<{ key: string; icon: LucideIcon; fun?: boolean }> = [
  { key: 'accounting', icon: BarChart3 },
  { key: 'decide', icon: ShieldCheck },
  { key: 'legal', icon: Scale },
  { key: 'coffee', icon: Coffee, fun: true },
]

function NotDoBlock() {
  const t = useTranslations('onboarding')

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {t.rich('notdo.eyebrow', {
            em: (chunks) => (
              <em className="italic text-foreground underline underline-offset-[3px]">{chunks}</em>
            ),
          })}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 gap-3.5 min-[520px]:grid-cols-2 min-[880px]:grid-cols-4">
        {NOTDO_ITEMS.map(({ key, icon: Icon, fun }) => (
          <div
            key={key}
            className={cn(
              'flex flex-col gap-2.5 rounded-xl border bg-muted/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft',
              fun && 'border-dashed bg-muted/25'
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <h4 className="text-[13.5px] font-semibold">{t(`notdo.items.${key}.title`)}</h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t(`notdo.items.${key}.desc`)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-dashed px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t('notdo.note')}</span>
      </p>
    </section>
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
