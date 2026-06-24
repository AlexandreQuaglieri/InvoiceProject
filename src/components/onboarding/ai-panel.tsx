'use client'

// Panneau « Avec l'IA » de l'étape en cours.
//  - ENTREPRISE : l'assistant cherche pour vous. Texte (nom / SIREN / infos) →
//    recherche base officielle (/api/company-search). 1 résultat → fiche
//    préremplie ; plusieurs → sélecteur ; aucun → repli extraction IA (Kbis
//    collé). Le dépôt d'un document → extraction vision (/api/extract-document).
//  - CLIENT : extraction IA (document ou texte libre).
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, Building2, CheckCircle2, ChevronRight, FileUp, Loader2, Search, Sparkles } from 'lucide-react'

import { PanelShell } from './panel-shell'
import { useOnboardingSubmit } from './use-onboarding-submit'
import type { ExtractStep } from './types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CompanyForm, type CompanyFormRef } from '@/components/company/company-form'
import { ClientForm } from '@/components/clients/client-form'
import { useLiveCompany } from '@/lib/realtime'
import type { CompanyFormData } from '@/lib/validations/company'
import type { Client } from '@/types/database'

// Forme renvoyée par /api/extract-document?kind=client (données nettoyées serveur).
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

// Candidat renvoyé par /api/company-search (base SIRENE).
type CompanyCandidate = {
  siren: string
  name: string
  city: string | null
  fields: Partial<CompanyFormData>
}

const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 Mo

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

interface AiPanelProps {
  step: ExtractStep
  // Repli « Remplir à la main » : bascule sur le panneau manuel de l'étape.
  onManualFallback: () => void
}

type Phase = 'idle' | 'analyzing' | 'searching' | 'candidates' | 'review'

export function AiPanel({ step, onManualFallback }: AiPanelProps) {
  const t = useTranslations('onboarding')
  const company = useLiveCompany()
  const { isLoading, submitClient } = useOnboardingSubmit()

  const [phase, setPhase] = useState<Phase>('idle')
  const [text, setText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [companyData, setCompanyData] = useState<Partial<CompanyFormData> | null>(null)
  const [clientDefaults, setClientDefaults] = useState<Client | null>(null)
  const [candidates, setCandidates] = useState<CompanyCandidate[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const companyFormRef = useRef<CompanyFormRef>(null)

  // Préremplissage du CompanyForm via son mécanisme setFormValues existant,
  // une fois le formulaire monté en phase review.
  useEffect(() => {
    if (phase === 'review' && step === 'company' && companyData) {
      companyFormRef.current?.setFormValues(companyData)
    }
  }, [phase, step, companyData])

  // Extraction IA d'un document/texte (Claude vision) — kind = step.
  const extract = async (input: { file?: File; text?: string }) => {
    setPhase('analyzing')
    try {
      const formData = new FormData()
      if (input.file) formData.append('file', input.file)
      if (input.text) formData.append('text', input.text)
      formData.append('kind', step)

      const response = await fetch('/api/extract-document', { method: 'POST', body: formData })
      const result = (await response.json()) as { success?: boolean; data?: unknown; error?: string }

      if (!response.ok || !result.success || !result.data) {
        toast.error(result.error || t('ai.extractError'))
        setPhase('idle')
        return
      }

      if (step === 'company') {
        setCompanyData(result.data as Partial<CompanyFormData>)
      } else {
        setClientDefaults(toClientDefaults(result.data as ClientExtract))
      }
      setPhase('review')
    } catch (error) {
      console.error('Extraction IA (onboarding) échouée', error)
      toast.error(t('ai.extractError'))
      setPhase('idle')
    }
  }

  // Recherche d'entreprise par nom / SIREN sur la base officielle.
  const searchCompany = async (query: string) => {
    setPhase('searching')
    try {
      const response = await fetch(`/api/company-search?q=${encodeURIComponent(query)}`)
      const data = (await response.json()) as { candidates?: CompanyCandidate[] }
      const found = data.candidates ?? []

      if (found.length === 0) {
        // Rien trouvé dans la base : peut-être un Kbis collé → extraction IA.
        await extract({ text: query })
        return
      }
      if (found.length === 1) {
        setCompanyData(found[0].fields)
        setPhase('review')
        return
      }
      setCandidates(found)
      setPhase('candidates')
    } catch (error) {
      console.error('Recherche entreprise échouée', error)
      await extract({ text: query })
    }
  }

  const pickCandidate = (candidate: CompanyCandidate) => {
    setCompanyData(candidate.fields)
    setPhase('review')
  }

  // Soumission du texte : entreprise = recherche ; client = extraction.
  const submitText = () => {
    const value = text.trim()
    if (!value) return
    if (step === 'company') void searchCompany(value)
    else void extract({ text: value })
  }

  // Validation partagée clic / glisser-déposer → toujours extraction (document).
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
    void extract({ file })
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
    setCandidates([])
    setPhase('idle')
  }

  const loadingLabel = phase === 'searching' ? t('ai.searching') : t(`ai.analyzing.${step}`)
  const loadingHint = phase === 'searching' ? t('ai.searchingHint') : t(`ai.analyzingHint.${step}`)

  return (
    <PanelShell>
      {phase === 'idle' && (
        <div className="flex flex-col gap-4">
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
            <span className="font-mono text-[11px] text-muted-foreground">{t('ai.dropHint')}</span>
          </button>

          <div className="space-y-2">
            <Label htmlFor={`onboarding-ai-text-${step}`}>{t(`ai.orPaste.${step}`)}</Label>
            <Textarea
              id={`onboarding-ai-text-${step}`}
              rows={step === 'company' ? 3 : 5}
              placeholder={t(`ai.placeholder.${step}`)}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={onManualFallback}>
              {t('ai.manualFallback')}
            </Button>
            <Button type="button" onClick={submitText} disabled={!text.trim()}>
              {step === 'company' ? (
                <Search className="mr-2 h-4 w-4" aria-hidden="true" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {step === 'company' ? t('ai.searchCta') : t('ai.analyze')}
            </Button>
          </div>
        </div>
      )}

      {(phase === 'analyzing' || phase === 'searching') && (
        <div className="flex flex-col gap-3 py-2" role="status">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span className="text-sm font-semibold">{loadingLabel}</span>
          </div>
          <p className="text-xs text-muted-foreground">{loadingHint}</p>
        </div>
      )}

      {phase === 'candidates' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            <span className="text-sm">{t('ai.candidatesTitle')}</span>
            <Button type="button" variant="ghost" size="sm" onClick={restart}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('ai.searchAgain')}
            </Button>
          </div>
          <ul className="space-y-2">
            {candidates.map((candidate) => (
              <li key={candidate.siren}>
                <button
                  type="button"
                  onClick={() => pickCandidate(candidate)}
                  className="flex w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{candidate.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[candidate.city, `SIREN ${candidate.siren}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" size="sm" onClick={onManualFallback}>
            {t('ai.candidatesNone')}
          </Button>
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
        </div>
      )}
    </PanelShell>
  )
}
