'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Plug } from 'lucide-react'

interface ActivatePdpButtonProps {
  className?: string
  label?: string
}

// Bouton « Activer la facturation électronique » → démarre le flow OAuth de
// raccordement à la PDP (route serveur /api/pdp/connect). La mention sous le
// bouton prévient de la redirection vers le partenaire agréé (Super PDP).
export function ActivatePdpButton({ className, label }: ActivatePdpButtonProps) {
  const t = useTranslations('nav')
  return (
    <div className="space-y-1.5">
      <Button asChild className={className}>
        <a href="/api/pdp/connect">
          <Plug className="mr-2 h-4 w-4" />
          {label ?? t('activateEInvoicingLong')}
        </a>
      </Button>
      <p className="text-xs text-muted-foreground">{t('pdpRedirectNotice')}</p>
    </div>
  )
}
