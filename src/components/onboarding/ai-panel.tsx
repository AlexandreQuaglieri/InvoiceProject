'use client'

// Panneau « Avec l'IA » : fichier (Kbis/PDF/image) ou texte libre →
// POST /api/extract-document (kind = étape) → formulaire de l'étape PRÉREMPLI
// que l'utilisateur vérifie puis soumet (mêmes patterns que les dialogs).
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, FileUp, Loader2, Sparkles } from 'lucide-react'

import { PanelShell } from './panel-shell'
import { useOnboardingSubmit } from './use-onboarding-submit'
import type { OnboardingStep } from './types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CompanyForm, type CompanyFormRef } from '@/components/company/company-form'
import { ClientForm } from '@/components/clients/client-form'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { useLiveClients, useLiveCompany } from '@/lib/realtime'
import type { CompanyFormData } from '@/lib/validations/company'
import type { Client, InvoiceWithRelations } from '@/types/database'

// Formes renvoyées par /api/extract-document selon `kind` (données nettoyées
// côté serveur — cleanClientData / cleanInvoiceData / extraction Kbis).
type ClientExtract = {
  name?: string
  type?: 'individual' | 'professional'
  email?: string
  phone?: string
  address?: string
  postal_code?: string
  city?: string
  siret?: string
  vat_number?: string
}

type InvoiceExtractItem = {
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
}

type InvoiceExtract = {
  client_name?: string
  notes?: string
  items?: InvoiceExtractItem[]
}

const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 Mo (copy de la dropzone)

// Valeurs initiales typées pour ClientForm (qui lit un Client complet) : seuls
// les champs du formulaire comptent, les métadonnées restent vides.
function toClientDefaults(data: ClientExtract): Client {
  return {
    id: '',
    company_id: '',
    type: data.type === 'individual' ? 'individual' : 'professional',
    name: data.name ?? '',
    siret: data.siret ?? null,
    vat_number: data.vat_number ?? null,
    address: data.address ?? '',
    postal_code: data.postal_code ?? '',
    city: data.city ?? '',
    country: 'France',
    email: data.email ?? null,
    phone: data.phone ?? null,
    notes: null,
    created_at: '',
    updated_at: '',
  }
}

// Valeurs initiales typées pour InvoiceForm : lignes extraites + client
// présélectionné si le nom matche (les totaux sont recalculés par le form/DB).
function toInvoiceDefaults(
  extract: InvoiceExtract,
  matchedClient: Client | undefined
): InvoiceWithRelations {
  const today = new Date().toISOString().split('T')[0]
  const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return {
    id: '',
    company_id: '',
    client_id: matchedClient?.id ?? '',
    number: '',
    status: 'draft',
    issue_date: today,
    due_date: due,
    paid_at: null,
    payment_terms: null,
    notes: extract.notes ?? null,
    discount_type: null,
    discount_value: 0,
    total_ht: 0,
    total_vat: 0,
    total_ttc: 0,
    pdf_url: null,
    pdp_deposit_id: null,
    pdp_transmitted_at: null,
    pdp_status: null,
    pdp_status_text: null,
    pdp_status_at: null,
    pdp_ereport_id: null,
    pdp_ereported_at: null,
    pdp_payment_report_id: null,
    pdp_payment_reported_at: null,
    created_at: '',
    updated_at: '',
    client: matchedClient ?? toClientDefaults({}),
    items: (extract.items ?? []).map((item, index) => ({
      id: '',
      invoice_id: '',
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      total_ht: 0,
      total_vat: 0,
      total_ttc: 0,
      position: index,
      created_at: '',
    })),
  }
}

interface AiPanelProps {
  step: OnboardingStep
  onClose: () => void
  // Fallback « Remplir à la main » : bascule sur le panneau manuel.
  onManualFallback: () => void
}

type Phase = 'idle' | 'analyzing' | 'review'

export function AiPanel({ step, onClose, onManualFallback }: AiPanelProps) {
  const t = useTranslations('onboarding')
  const company = useLiveCompany()
  const clients = useLiveClients()
  const { isLoading, submitClient, submitInvoice } = useOnboardingSubmit()

  const [phase, setPhase] = useState<Phase>('idle')
  const [text, setText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [companyData, setCompanyData] = useState<Partial<CompanyFormData> | null>(null)
  const [clientDefaults, setClientDefaults] = useState<Client | null>(null)
  const [invoiceDefaults, setInvoiceDefaults] = useState<InvoiceWithRelations | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const companyFormRef = useRef<CompanyFormRef>(null)

  // Préremplissage du CompanyForm via son mécanisme setFormValues existant,
  // une fois le formulaire monté en phase review.
  useEffect(() => {
    if (phase === 'review' && step === 'company' && companyData) {
      companyFormRef.current?.setFormValues(companyData)
    }
  }, [phase, step, companyData])

  const matchClient = (name?: string): Client | undefined => {
    if (!name) return undefined
    const needle = name.trim().toLowerCase()
    return clients.find((client) => client.name.trim().toLowerCase() === needle)
  }

  const analyze = async (input: { file?: File; text?: string }) => {
    setPhase('analyzing')
    try {
      const formData = new FormData()
      if (input.file) formData.append('file', input.file)
      if (input.text) formData.append('text', input.text)
      formData.append('kind', step)

      const response = await fetch('/api/extract-document', { method: 'POST', body: formData })
      const result = (await response.json()) as {
        success?: boolean
        data?: unknown
        error?: string
      }

      if (!response.ok || !result.success || !result.data) {
        // Rate-limit / clé API / analyse impossible : on affiche l'erreur API.
        toast.error(result.error || t('ai.extractError'))
        setPhase('idle')
        return
      }

      if (step === 'company') {
        setCompanyData(result.data as Partial<CompanyFormData>)
      } else if (step === 'client') {
        setClientDefaults(toClientDefaults(result.data as ClientExtract))
      } else {
        const extract = result.data as InvoiceExtract
        if (!extract.items || extract.items.length === 0) {
          toast.error(t('ai.noItems'))
          setPhase('idle')
          return
        }
        setInvoiceDefaults(toInvoiceDefaults(extract, matchClient(extract.client_name)))
      }
      setPhase('review')
    } catch (error) {
      console.error('Extraction IA (onboarding) échouée', error)
      toast.error(t('ai.extractError'))
      setPhase('idle')
    }
  }

  // Validation partagée clic / glisser-déposer.
  const acceptFile = (file: File | undefined | null) => {
    if (!file) return
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error(t('ai.fileType'))
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('ai.fileTooLarge'))
      return
    }
    void analyze({ file })
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    acceptFile(file)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    acceptFile(event.dataTransfer.files?.[0])
  }

  const restart = () => {
    setCompanyData(null)
    setClientDefaults(null)
    setInvoiceDefaults(null)
    setPhase('idle')
  }

  // Dropzone sur toutes les étapes : Kbis (entreprise), email/carte (client),
  // devis ou photo de prestation (facture) — l'extraction vision lit tout.
  const hasDropzone = true

  return (
    <PanelShell
      icon={Sparkles}
      title={t(`ai.title.${step}`)}
      subtitle={t(`ai.subtitle.${step}`)}
      onClose={onClose}
    >
      {phase === 'idle' && (
        <div className="flex flex-col gap-4">
          {hasDropzone && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_FILE_TYPES.join(',')}
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                aria-label={t(`ai.dropTitle.${step}`)}
                className={`flex w-full flex-col items-center gap-2.5 rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  isDragging
                    ? 'border-border-strong bg-muted'
                    : 'border-border-strong/40 bg-muted/50 hover:bg-muted'
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border bg-background">
                  <FileUp className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold">{t(`ai.dropTitle.${step}`)}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {t('ai.dropHint')}
                </span>
              </button>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor={`onboarding-ai-text-${step}`}>{t(`ai.orPaste.${step}`)}</Label>
            <Textarea
              id={`onboarding-ai-text-${step}`}
              rows={step === 'invoice' ? 3 : 5}
              placeholder={t(`ai.placeholder.${step}`)}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={onManualFallback}>
              {t('ai.manualFallback')}
            </Button>
            <Button type="button" onClick={() => void analyze({ text })} disabled={!text.trim()}>
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              {step === 'invoice' ? t('ai.generate') : t('ai.analyze')}
            </Button>
          </div>
        </div>
      )}

      {phase === 'analyzing' && (
        <div className="flex flex-col gap-3 py-2" role="status">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span className="text-sm font-semibold">{t(`ai.analyzing.${step}`)}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t(`ai.analyzingHint.${step}`)}</p>
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {t(`ai.reviewBanner.${step}`)}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={restart}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('ai.restart')}
            </Button>
          </div>

          {step === 'company' && <CompanyForm ref={companyFormRef} company={company} embedded />}
          {step === 'client' && clientDefaults && (
            <ClientForm client={clientDefaults} onSubmit={submitClient} isLoading={isLoading} />
          )}
          {step === 'invoice' && invoiceDefaults && (
            <InvoiceForm
              invoice={invoiceDefaults}
              clients={clients}
              onSubmit={submitInvoice}
              isLoading={isLoading}
              embedded
            />
          )}
        </div>
      )}
    </PanelShell>
  )
}
