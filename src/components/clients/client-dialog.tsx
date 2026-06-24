'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, Building2, ChevronRight, Loader2, Pencil, Plus, Search, Sparkles } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { ClientForm } from './client-form'
import { createClientAction, updateClientAction } from '@/actions/clients'
import { useLiveStoreActions } from '@/lib/realtime'
import type { ClientFormData } from '@/lib/validations/client'
import type { CompanyFormData } from '@/lib/validations/company'
import type { Client } from '@/types/database'

interface ClientDialogProps {
  client?: Client
  trigger?: React.ReactNode
}

// Candidat renvoyé par /api/company-search (base SIRENE).
type CompanyCandidate = { siren: string; name: string; city: string | null; fields: Partial<CompanyFormData> }

// Mappe une entreprise officielle (champs société) vers un client professionnel.
// On n'emporte PAS l'email du compte (extras) : ici c'est l'email DU CLIENT.
function candidateToClient(fields: Partial<CompanyFormData>): Client {
  return {
    id: '',
    company_id: '',
    type: 'professional',
    name: fields.name ?? '',
    siret: fields.siret ?? null,
    vat_number: fields.vat_number ?? null,
    address: fields.address ?? '',
    postal_code: fields.postal_code ?? '',
    city: fields.city ?? '',
    country: 'France',
    email: null,
    phone: null,
    notes: null,
    created_at: '',
    updated_at: '',
  }
}

export function ClientDialog({ client, trigger }: ClientDialogProps) {
  const t = useTranslations()
  const { upsertClient } = useLiveStoreActions()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Bandeau IA (création uniquement) : pré-remplit le formulaire en place.
  const [draft, setDraft] = useState<Client | null>(null)
  const [draftVersion, setDraftVersion] = useState(0) // force le remount du form
  const [aiQuery, setAiQuery] = useState('')
  const [aiPhase, setAiPhase] = useState<'idle' | 'searching' | 'candidates'>('idle')
  const [candidates, setCandidates] = useState<CompanyCandidate[]>([])

  const resetAi = () => {
    setDraft(null)
    setDraftVersion(0)
    setAiQuery('')
    setAiPhase('idle')
    setCandidates([])
  }

  const applyDraft = (data: Client) => {
    setDraft(data)
    setDraftVersion((v) => v + 1)
    setAiPhase('idle')
    setCandidates([])
    toast.success(t('clients.aiFill.filled'))
  }

  const aiSearch = async () => {
    const q = aiQuery.trim()
    if (q.length < 3) return
    setAiPhase('searching')
    try {
      const response = await fetch(`/api/company-search?q=${encodeURIComponent(q)}`)
      const data = (await response.json()) as { candidates?: CompanyCandidate[] }
      const found = data.candidates ?? []
      if (found.length === 0) {
        toast.message(t('clients.aiFill.notFound'))
        setAiPhase('idle')
        return
      }
      if (found.length === 1) {
        applyDraft(candidateToClient(found[0].fields))
        return
      }
      setCandidates(found)
      setAiPhase('candidates')
    } catch (error) {
      console.error('Recherche client (IA) échouée', error)
      toast.error(t('clients.aiFill.error'))
      setAiPhase('idle')
    }
  }

  const handleSubmit = async (data: ClientFormData) => {
    setIsLoading(true)
    try {
      const result = client
        ? await updateClientAction(client.id, data)
        : await createClientAction(data)

      if (result.success) {
        // Write-through : l'action renvoie la ligne complète, le store live
        // reflète immédiatement la création/mise à jour (Realtime réconcilie).
        if (result.data) upsertClient(result.data)
        toast.success(client ? 'Client mis à jour' : 'Client créé')
        setOpen(false)
        resetAi()
      } else {
        toast.error(result.error || 'Une erreur est survenue')
      }
    } catch (error) {
      console.error('Enregistrement du client échoué', error)
      toast.error('Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) resetAi()
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            {client ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                {t('common.edit')}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {t('clients.new')}
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? t('common.edit') : t('clients.new')}</DialogTitle>
          <DialogDescription>
            {client
              ? 'Modifiez les informations du client.'
              : 'Ajoutez un nouveau client à votre liste.'}
          </DialogDescription>
        </DialogHeader>

        {/* Bandeau IA : enrichit la fiche (création uniquement). Le formulaire
            manuel reste entièrement disponible en dessous. */}
        {!client && (
          <div className="space-y-3 rounded-xl border bg-muted/40 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              {t('clients.aiFill.title')}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void aiSearch()
              }}
              className="flex gap-2"
            >
              <Input
                value={aiQuery}
                onChange={(event) => setAiQuery(event.target.value)}
                placeholder={t('clients.aiFill.placeholder')}
                aria-label={t('clients.aiFill.title')}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={aiPhase === 'searching' || aiQuery.trim().length < 3}
                className="shrink-0"
              >
                {aiPhase === 'searching' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {t('clients.aiFill.cta')}
              </Button>
            </form>

            {aiPhase === 'candidates' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {t('clients.aiFill.candidatesTitle')}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAiPhase('idle')}>
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {t('clients.aiFill.back')}
                  </Button>
                </div>
                <ul className="space-y-1.5">
                  {candidates.map((candidate) => (
                    <li key={candidate.siren}>
                      <button
                        type="button"
                        onClick={() => applyDraft(candidateToClient(candidate.fields))}
                        className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{candidate.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[candidate.city, `SIREN ${candidate.siren}`].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">{t('clients.aiFill.hint')}</p>
          </div>
        )}

        <ClientForm
          key={draftVersion}
          client={draft ?? client}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  )
}
