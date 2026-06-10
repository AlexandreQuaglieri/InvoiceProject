'use client'

// Carte de méthode du hub d'onboarding — composant UI pur (props in, zéro accès
// données). Réinterprétation Tailwind/tokens des .method-card du handoff design.
import { ArrowRight, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface MethodCardProps {
  icon: LucideIcon
  title: string
  badge?: { label: string; variant: 'solid' | 'ghost' }
  tag: string
  description: string
  time: string
  cta: string
  hero?: boolean
  selected?: boolean
  onSelect: () => void
}

export function MethodCard({
  icon: Icon,
  title,
  badge,
  tag,
  description,
  time,
  cta,
  hero = false,
  selected = false,
  onSelect,
}: MethodCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      className={cn(
        'group relative flex min-h-[204px] flex-col gap-2.5 rounded-xl border bg-card p-5 text-left shadow-soft transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-foreground hover:shadow-pop',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        hero && 'border-border-strong ring-1 ring-border-strong',
        selected && 'border-foreground ring-1 ring-foreground'
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted',
          hero && 'border-primary bg-primary text-primary-foreground'
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>

      <span className="flex items-center gap-2">
        <span className="text-[15px] font-semibold">{title}</span>
        {badge ? (
          <Badge variant={badge.variant === 'solid' ? 'default' : 'outline'} className="text-[11px]">
            {badge.label}
          </Badge>
        ) : null}
      </span>

      <span className="text-xs italic leading-snug text-muted-foreground">{tag}</span>

      <span
        className={cn(
          'flex-1 text-[13px] leading-relaxed text-muted-foreground',
          hero && 'text-foreground'
        )}
      >
        {description}
      </span>

      <span className="mt-1 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {time}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
          {cta}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </span>
    </button>
  )
}
