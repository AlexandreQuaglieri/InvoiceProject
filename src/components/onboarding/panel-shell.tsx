'use client'

// Coquille commune des panneaux de méthode (IA / MCP / Manuel) : entête avec
// icône, titres et bouton fermer, corps libre. Composant UI pur.
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

interface PanelShellProps {
  icon: LucideIcon
  title: string
  subtitle: string
  onClose: () => void
  children: React.ReactNode
}

export function PanelShell({ icon: Icon, title, subtitle, onClose, children }: PanelShellProps) {
  const t = useTranslations('onboarding')

  return (
    <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-soft motion-safe:animate-[panel-in_0.3s_ease-out]">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={t('panel.close')}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
