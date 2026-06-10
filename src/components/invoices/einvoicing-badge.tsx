'use client'

// Badge e-invoicing PUR : dérive son affichage de l'état PDP de la facture
// (einvoicingState — fonction pure, charte règle 1). Aucune donnée fetchée ici :
// les colonnes pdp_* arrivent par props depuis le store live (Realtime).
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { einvoicingState, type EinvoicingTone } from '@/lib/einvoicing/status'
import type { Invoice } from '@/types/database'

interface EinvoicingBadgeProps {
  invoice: Pick<Invoice, 'pdp_deposit_id' | 'pdp_status' | 'pdp_status_text'>
}

// Tons → variantes Badge shadcn + accents via tokens Tailwind (aucun hex en dur).
const toneStyles: Record<
  EinvoicingTone,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  neutral: { variant: 'secondary' },
  info: {
    variant: 'secondary',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  },
  success: {
    variant: 'secondary',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  },
  warning: {
    variant: 'secondary',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
  destructive: { variant: 'destructive' },
}

export function EinvoicingBadge({ invoice }: EinvoicingBadgeProps) {
  const t = useTranslations()
  const state = einvoicingState(invoice)

  if (state.kind === 'none') return null

  if (state.kind === 'transmitted') {
    const label = t('einvoicing.status.transmitted')
    return (
      <Badge variant="secondary" aria-label={label}>
        {label}
      </Badge>
    )
  }

  // kind === 'status' : libellé i18n si le code est connu, sinon texte brut/code.
  const label = state.info
    ? t(`einvoicing.status.${state.info.labelKey}`)
    : state.statusText || state.code
  const tone = toneStyles[state.info?.tone ?? 'neutral']

  return (
    <Badge variant={tone.variant} className={tone.className} aria-label={label}>
      {label}
    </Badge>
  )
}
