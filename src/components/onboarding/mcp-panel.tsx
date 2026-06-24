'use client'

// Panneau « Via Claude ou ChatGPT » (MCP) : 4 étapes réelles de connexion.
// Aucune simulation — dès que l'assistant écrit via MCP, Realtime fait avancer
// la page automatiquement (le store live est la seule source d'avancement).
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Copy, Plug, Zap } from 'lucide-react'

import { PanelShell } from './panel-shell'
import type { ExtractStep } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getMcpConnectorUrl } from '@/lib/base-url'

interface McpPanelProps {
  step: ExtractStep
  onClose?: () => void
}

export function McpPanel({ step, onClose }: McpPanelProps) {
  const t = useTranslations('onboarding')
  const [copied, setCopied] = useState(false)
  const url = getMcpConnectorUrl()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t('mcp.copied'))
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error("Copie de l'URL MCP échouée", error)
      toast.error(t('mcp.copyError'))
    }
  }

  return (
    <PanelShell icon={Plug} title={t('mcp.title')} subtitle={t('mcp.subtitle')} onClose={onClose}>
      <ol className="flex flex-col gap-4">
        <li className="flex items-start gap-3">
          <StepNumber value="01" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5 text-sm">
            <p>{t('mcp.step1')}</p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={url}
                onFocus={(event) => event.target.select()}
                className="h-9 font-mono text-xs"
                aria-label={t('mcp.step1')}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void handleCopy()}
                aria-label={t('mcp.copy')}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <StepNumber value="02" />
          <div className="min-w-0 flex-1 pt-0.5 text-sm">
            <p>{t('mcp.step2')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('mcp.step2Sub')}</p>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <StepNumber value="03" />
          <div className="min-w-0 flex-1 pt-0.5 text-sm">
            <p>{t('mcp.step3')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('mcp.step3Sub')}</p>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <StepNumber value="04" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5 text-sm">
            <p>{t('mcp.step4')}</p>
            <p className="w-fit max-w-full rounded-xl rounded-br-sm border bg-muted px-3.5 py-2.5 text-[13px]">
              {t(`mcp.ask.${step}`)}
            </p>
          </div>
        </li>
      </ol>

      <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-dashed px-3.5 py-3 text-xs text-muted-foreground">
        <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t('mcp.realtime')}</span>
      </div>
    </PanelShell>
  )
}

function StepNumber({ value }: { value: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-[11px] font-semibold"
    >
      {value}
    </span>
  )
}
