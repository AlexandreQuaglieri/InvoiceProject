import { Fragment } from 'react'
import { useTranslations } from 'next-intl'
import { Bot, Check } from 'lucide-react'
import { SACam } from '@/components/brand/street-art'

/**
 * Section MCP — sombre dans les DEUX thèmes : la classe `dark` posée sur la
 * section réapplique les tokens sombres à tout son contenu (custom-variant
 * `&:is(.dark *)` de globals.css), donc `bg-background`/`text-foreground`
 * et tous les tokens enfants basculent automatiquement.
 */
export function McpSection() {
  const t = useTranslations('landing.mcp')
  const compatNames = t.raw('compatNames') as string[]

  const steps = [
    { n: '01', text: t('steps.one'), sub: t('steps.oneSub') },
    { n: '02', text: t('steps.two'), sub: t('steps.twoSub') },
    { n: '03', text: t('steps.three'), sub: null },
  ]

  const exchanges = [
    { user: t('chat.user1'), ai: t('chat.ai1'), badge: t('chat.badge1') },
    { user: t('chat.user2'), ai: t('chat.ai2'), badge: t('chat.badge2') },
  ]

  return (
    <section
      id="claude"
      className="dark relative scroll-mt-16 overflow-hidden bg-background text-foreground"
    >
      <SACam
        size={84}
        flip
        className="pointer-events-none absolute right-[4%] top-4 select-none text-foreground opacity-30"
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 sm:px-7 lg:grid-cols-2 lg:gap-14">
        <div>
          <div className="mb-6 max-w-2xl">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground">
              {t('eyebrow')}
            </span>
            <h2 className="mb-3 mt-3.5 text-balance text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
              {t('title')}
            </h2>
            <p className="text-pretty text-base text-muted-foreground">{t('subtitle')}</p>
          </div>
          <ol className="mt-2 flex flex-col gap-4.5">
            {steps.map((step) => (
              <li key={step.n} className="flex items-baseline gap-3.5 text-[14.5px]">
                <span className="shrink-0 basis-[22px] font-mono text-xs text-muted-foreground">
                  {step.n}
                </span>
                <span>
                  {step.text}
                  {step.sub && <span className="text-muted-foreground"> {step.sub}</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[13px] italic text-muted-foreground">{t('claim')}</p>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5 border-t pt-4 text-[13.5px]">
            <span className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
              {t('compatLabel')}
            </span>
            {compatNames.map((name, i) => (
              <Fragment key={name}>
                {i > 0 && (
                  <span className="text-muted-foreground/60" aria-hidden="true">
                    ·
                  </span>
                )}
                <span className="font-semibold">{name}</span>
              </Fragment>
            ))}
            <span className="text-xs italic text-muted-foreground">{t('compatSoon')}</span>
          </div>
        </div>

        {/* Conversation claude.ai mockée */}
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 text-card-foreground">
          <div className="flex items-center gap-2 border-b pb-2.5 text-[12.5px] text-muted-foreground">
            <Bot className="size-[15px]" aria-hidden="true" />
            {t('chat.header')}
          </div>
          {exchanges.map((exchange) => (
            <Fragment key={exchange.badge}>
              <div className="max-w-[88%] self-end rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-[13.5px] leading-normal text-primary-foreground">
                {exchange.user}
              </div>
              <div className="max-w-[88%] self-start rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-[13.5px] leading-normal">
                {exchange.ai}
                <span className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-foreground/10 px-2 py-0.5 font-mono text-[11px]">
                  <Check className="size-[11px]" aria-hidden="true" />
                  {exchange.badge}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}
