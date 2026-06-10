import { useTranslations } from 'next-intl'
import {
  BarChart3,
  BellRing,
  Check,
  FileCheck,
  Lock,
  PenLine,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type DoDontItem = { title: string; body: string }

const DOES_ICONS: LucideIcon[] = [ShieldCheck, FileCheck, BellRing, Lock]
const DONTS_ICONS: LucideIcon[] = [BarChart3, PenLine, Zap, Sparkles]

function ItemList({ items, icons, lastDashed }: {
  items: DoDontItem[]
  icons: LucideIcon[]
  lastDashed?: boolean
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const Icon = icons[i] ?? Check
        const isFun = Boolean(lastDashed) && i === items.length - 1
        return (
          <div
            key={item.title}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 text-card-foreground',
              isFun && 'border-dashed'
            )}
          >
            <Icon className="mt-0.5 size-[19px] shrink-0" aria-hidden="true" />
            <div>
              <strong className="block text-[14.5px] font-semibold">{item.title}</strong>
              <span className="text-[13px] text-muted-foreground">{item.body}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** « Ce qu'il fait / ce qu'il ne fera jamais » — RSC pur. */
export function DoDontSection() {
  const t = useTranslations('landing.doDont')
  const does = t.raw('does') as DoDontItem[]
  const donts = t.raw('donts') as DoDontItem[]

  return (
    <section id="fonctionnalites" className="scroll-mt-16">
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
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="mb-4.5 flex items-center gap-2.5 text-xl font-bold tracking-tight">
              <Check className="size-5" aria-hidden="true" />
              {t('doesTitle')}
            </h3>
            <ItemList items={does} icons={DOES_ICONS} />
          </div>
          <div>
            <h3 className="mb-4.5 flex items-center gap-2.5 text-xl font-bold tracking-tight">
              <X className="size-5" aria-hidden="true" />
              <span>
                {t.rich('dontsTitle', {
                  em: (chunks) => <em className="underline underline-offset-4">{chunks}</em>,
                })}
              </span>
            </h3>
            <ItemList items={donts} icons={DONTS_ICONS} lastDashed />
          </div>
        </div>
      </div>
    </section>
  )
}
