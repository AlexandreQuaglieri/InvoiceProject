'use client'

import { Button } from '@/components/ui/button'
import { Plug } from 'lucide-react'

interface ActivatePdpButtonProps {
  className?: string
  label?: string
}

// Bouton « Activer la facturation électronique » → démarre le flow OAuth de
// raccordement à la PDP (route serveur /api/pdp/connect).
export function ActivatePdpButton({
  className,
  label = 'Activer la facturation électronique',
}: ActivatePdpButtonProps) {
  return (
    <Button asChild className={className}>
      <a href="/api/pdp/connect">
        <Plug className="mr-2 h-4 w-4" />
        {label}
      </a>
    </Button>
  )
}
