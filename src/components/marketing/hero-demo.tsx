'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Démo vivante du héro : la phrase se tape, la facture se construit en phases
 * (typing → sending → client → line → totals → stamp).
 *
 * Le PREMIER rendu est le document COMPLET et statique (SEO + hydratation sans
 * mismatch) ; l'animation ne démarre que dans un useEffect, et uniquement si
 * l'utilisateur n'a pas demandé `prefers-reduced-motion`.
 */

type Phase = 'typing' | 'sending' | 'client' | 'line' | 'totals' | 'stamp'

const PHASE_ORDER: Phase[] = ['typing', 'sending', 'client', 'line', 'totals', 'stamp']

type DemoExample = {
  chip: string
  text: string
  clientName: string
  clientL1: string
  clientL2: string
  desc: string
  qty: number
  unitPrice: number
}

const TYPING_DELAY_MS = 280
const TYPING_SPEED_MS = 26

export function HeroDemo() {
  const t = useTranslations('landing.heroDemo')
  const locale = useLocale()
  const examples = t.raw('examples') as DemoExample[]

  // État final dès le premier rendu (document complet, pas d'animation au paint).
  const [exIdx, setExIdx] = useState(0)
  const [typed, setTyped] = useState(() => examples[0]?.text ?? '')
  const [phase, setPhase] = useState<Phase>('stamp')

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const reducedRef = useRef(true)

  const clearAll = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const play = (idx: number) => {
    clearAll()
    setExIdx(idx)
    const ex = examples[idx]
    if (!ex) return
    if (reducedRef.current) {
      // Pas d'animation : on affiche directement l'état final.
      setTyped(ex.text)
      setPhase('stamp')
      return
    }
    setTyped('')
    setPhase('typing')
    const schedule = (ms: number, fn: () => void) => {
      timersRef.current.push(setTimeout(fn, ms))
    }
    const chars = [...ex.text]
    chars.forEach((_, i) => {
      schedule(TYPING_DELAY_MS + i * TYPING_SPEED_MS, () => setTyped(ex.text.slice(0, i + 1)))
    })
    const tEnd = TYPING_DELAY_MS + chars.length * TYPING_SPEED_MS
    schedule(tEnd + 250, () => setPhase('sending'))
    schedule(tEnd + 700, () => setPhase('client'))
    schedule(tEnd + 1150, () => setPhase('line'))
    schedule(tEnd + 1600, () => setPhase('totals'))
    schedule(tEnd + 2150, () => setPhase('stamp'))
  }

  useEffect(() => {
    // prefers-reduced-motion testé en effet uniquement, jamais au render.
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reducedRef.current) play(0)
    return clearAll
    // Lancement unique au montage (StrictMode : le cleanup purge les timers).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ex = examples[exIdx] ?? examples[0]
  if (!ex) return null

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
  const ht = ex.qty * ex.unitPrice
  const show = (p: Phase) => PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(p)

  const revealClass = 'motion-safe:animate-[reveal_0.45s_cubic-bezier(0.16,1,0.3,1)]'

  return (
    <div className="flex flex-col gap-3.5">
      {/* Faux chat */}
      <div className="rounded-2xl border bg-card p-4 text-card-foreground shadow-soft">
        <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
          <Sparkles className="size-3" aria-hidden="true" />
          {t('label')}
        </div>
        <div className="flex items-end gap-2.5">
          <div className="min-h-[42px] flex-1 text-sm leading-relaxed">
            {typed}
            {phase === 'typing' && (
              <span
                className="-mb-0.5 ml-px inline-block h-4 w-px bg-foreground motion-safe:animate-[blink_1s_steps(1)_infinite]"
                aria-hidden="true"
              />
            )}
          </div>
          <div
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform',
              phase === 'sending' && 'scale-110'
            )}
            aria-hidden="true"
          >
            <Send className="size-4" />
          </div>
        </div>
      </div>

      {/* Document facture */}
      <div className="relative">
        <div className="min-h-[300px] rounded-xl border bg-paper px-6 py-6 text-[11.5px] leading-[1.45] text-paper-foreground shadow-pop">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-bold">{t('doc.brand')}</div>
              <div className="text-[9.5px] text-paper-foreground/55">{t('doc.brandSub')}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-foreground/55">
                {t('doc.type')}
              </div>
              <div className="font-mono text-xs font-semibold">{t('doc.number')}</div>
            </div>
          </div>

          <div className="my-4 grid grid-cols-2 gap-3.5">
            <div>
              <div className="mb-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-paper-foreground/55">
                {t('doc.issuer')}
              </div>
              <div className="font-semibold">{t('doc.issuerName')}</div>
              <div className="text-[10px] text-paper-foreground/65">{t('doc.issuerAddress')}</div>
              <div className="font-mono text-[10px] text-paper-foreground/65">
                {t('doc.issuerSiret')}
              </div>
            </div>
            <div>
              <div className="mb-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-paper-foreground/55">
                {t('doc.billedTo')}
              </div>
              {show('client') ? (
                <div key={`${exIdx}-client`} className={revealClass}>
                  <div className="font-semibold">{ex.clientName}</div>
                  <div className="text-[10px] text-paper-foreground/65">{ex.clientL1}</div>
                  <div className="font-mono text-[10px] text-paper-foreground/65">{ex.clientL2}</div>
                </div>
              ) : (
                <div className="italic text-paper-foreground/45">{t('pendingClient')}</div>
              )}
            </div>
          </div>

          <table className="my-2 w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-paper-foreground p-1 text-left font-mono text-[8.5px] font-medium uppercase tracking-[0.08em] text-paper-foreground/55">
                  {t('doc.thDesc')}
                </th>
                <th className="border-b border-paper-foreground p-1 text-right font-mono text-[8.5px] font-medium uppercase tracking-[0.08em] text-paper-foreground/55">
                  {t('doc.thQty')}
                </th>
                <th className="border-b border-paper-foreground p-1 text-right font-mono text-[8.5px] font-medium uppercase tracking-[0.08em] text-paper-foreground/55">
                  {t('doc.thUnit')}
                </th>
                <th className="border-b border-paper-foreground p-1 text-right font-mono text-[8.5px] font-medium uppercase tracking-[0.08em] text-paper-foreground/55">
                  {t('doc.thVat')}
                </th>
                <th className="border-b border-paper-foreground p-1 text-right font-mono text-[8.5px] font-medium uppercase tracking-[0.08em] text-paper-foreground/55">
                  {t('doc.thTotal')}
                </th>
              </tr>
            </thead>
            <tbody>
              {show('line') ? (
                <tr key={`${exIdx}-line`} className={revealClass}>
                  <td className="border-b border-paper-foreground/10 p-1.5 text-[10.5px]">
                    {ex.desc}
                  </td>
                  <td className="border-b border-paper-foreground/10 p-1.5 text-right font-mono text-[10.5px]">
                    {ex.qty}
                  </td>
                  <td className="border-b border-paper-foreground/10 p-1.5 text-right font-mono text-[10.5px]">
                    {fmt(ex.unitPrice)}
                  </td>
                  <td className="border-b border-paper-foreground/10 p-1.5 text-right font-mono text-[10.5px]">
                    {t('doc.vatRate')}
                  </td>
                  <td className="border-b border-paper-foreground/10 p-1.5 text-right font-mono text-[10.5px]">
                    {fmt(ht)}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="border-b border-paper-foreground/10 p-1.5 italic text-paper-foreground/45"
                  >
                    {t('pendingLine')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-2.5 flex flex-col items-end gap-1">
            {show('totals') ? (
              <div key={`${exIdx}-totals`} className={cn('flex w-full flex-col items-end gap-1', revealClass)}>
                <div className="flex w-[190px] justify-between text-[10.5px] text-paper-foreground/65">
                  <span>{t('doc.totalHt')}</span>
                  <span className="font-mono">{fmt(ht)}</span>
                </div>
                <div className="flex w-[190px] justify-between text-[10.5px] text-paper-foreground/65">
                  <span>{t('doc.totalVat')}</span>
                  <span className="font-mono">{fmt(ht * 0.2)}</span>
                </div>
                <div className="flex w-[190px] justify-between border-t border-paper-foreground pt-1.5 text-xs font-bold">
                  <span>{t('doc.totalTtc')}</span>
                  <span className="font-mono">{fmt(ht * 1.2)}</span>
                </div>
              </div>
            ) : (
              <div className="flex w-[190px] justify-between text-[10.5px]">
                <span className="italic text-paper-foreground/45">{t('pendingTotals')}</span>
                <span />
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between border-t border-paper-foreground/10 pt-2.5 font-mono text-[8.5px] text-paper-foreground/55">
            <span>{t('doc.footEmail')}</span>
            <span>{t('doc.footCompliance')}</span>
          </div>
        </div>

        {show('stamp') && (
          <div
            key={`${exIdx}-stamp`}
            className="absolute bottom-16 left-5 -rotate-[8deg] rounded border-2 border-paper-foreground px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper-foreground motion-safe:animate-[stamp_0.35s_cubic-bezier(0.16,1,0.3,1)]"
          >
            {t('doc.stamp')}
          </div>
        )}
      </div>

      {/* Chips d'exemples + replay */}
      <div className="flex flex-wrap gap-2">
        {examples.map((e, i) => (
          <button
            key={e.chip}
            type="button"
            onClick={() => play(i)}
            aria-pressed={i === exIdx}
            className={cn(
              'rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              i === exIdx && 'border-border-strong text-foreground'
            )}
          >
            {e.chip}
          </button>
        ))}
        <button
          type="button"
          onClick={() => play(exIdx)}
          aria-label={t('replayTitle')}
          className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('replay')}
        </button>
      </div>
    </div>
  )
}
