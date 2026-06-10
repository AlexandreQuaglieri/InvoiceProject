import { useTranslations } from 'next-intl'
import { PenLine, Plug, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/** « Trois façons de facturer » — RSC pur. */
export function MethodsSection() {
  const t = useTranslations('landing.methods')

  const cards = [
    {
      key: 'ai',
      hero: true,
      icon: Sparkles,
      title: t('ai.title'),
      badge: t('ai.badge'),
      badgeGhost: false,
      tag: t('ai.tag'),
      body: t('ai.body'),
    },
    {
      key: 'mcp',
      hero: false,
      icon: Plug,
      title: t('mcp.title'),
      badge: t('mcp.badge'),
      badgeGhost: true,
      tag: t('mcp.tag'),
      body: t('mcp.body'),
    },
    {
      key: 'manual',
      hero: false,
      icon: PenLine,
      title: t('manual.title'),
      badge: null,
      badgeGhost: false,
      tag: t('manual.tag'),
      body: t('manual.body'),
    },
  ] as const

  return (
    <section id="methodes" className="scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-7">
        <div className="mb-11 max-w-2xl">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground">
            {t('eyebrow')}
          </span>
          <h2 className="mb-3 mt-3.5 text-balance text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
            {t('title')}
          </h2>
          <p className="text-pretty text-base text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-[1.25fr_1fr_1fr]">
          {cards.map((card) => (
            <div
              key={card.key}
              className={cn(
                'flex flex-col gap-2.5 rounded-2xl border bg-card p-6 text-card-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-pop',
                card.hero && 'border-border-strong ring-1 ring-border-strong'
              )}
            >
              <div
                className={cn(
                  'mb-1.5 flex size-[42px] items-center justify-center rounded-xl',
                  card.hero
                    ? 'bg-primary text-primary-foreground'
                    : 'border bg-muted text-foreground'
                )}
              >
                <card.icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="flex flex-wrap items-center gap-2 text-[17px] font-bold">
                {card.title}
                {card.badge && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]',
                      card.badgeGhost
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary text-primary-foreground'
                    )}
                  >
                    {card.badge}
                  </span>
                )}
              </h3>
              <div className="text-[12.5px] italic text-muted-foreground">{card.tag}</div>
              <p className="text-sm text-muted-foreground">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
