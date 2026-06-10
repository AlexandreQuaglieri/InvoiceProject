'use server'

// Server actions de la réception e-invoicing (factures entrantes).
// Boundary fin : auth → validation → service einvoicing.
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { superPdpForUser, friendlyPdpError } from '@/lib/pdp'
import { resolveCompanyId, syncInbound, setInboundStatus } from '@/lib/services'
import type { InboundInvoice } from '@/types/database'

// Lecture des factures reçues persistées (seed du store live).
export async function getInboundInvoices(): Promise<InboundInvoice[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const companyId = await resolveCompanyId(supabase, user.id)
  if (!companyId.ok) return []

  const { data, error } = await supabase
    .from('inbound_invoices')
    .select('*')
    .eq('company_id', companyId.data)
    .order('received_at', { ascending: false })

  if (error) {
    console.error('[inbound] lecture des factures reçues en échec', error)
    return []
  }
  return (data ?? []) as InboundInvoice[]
}

// Synchronise l'inbox depuis la PDP. STRICTEMENT via le raccordement de
// l'utilisateur : sans raccordement, on ne persiste rien (le fallback éditeur
// écrirait des données qui ne sont pas celles du client).
export async function syncInboundAction(): Promise<{
  success: boolean
  error?: string
  connected: boolean
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié', connected: false }

  const pdp = await superPdpForUser(supabase, user.id)
  if (!pdp) return { success: true, connected: false }

  const companyId = await resolveCompanyId(supabase, user.id)
  if (!companyId.ok) return { success: false, error: companyId.error, connected: true }

  try {
    const result = await syncInbound(supabase, { userId: user.id, companyId: companyId.data }, pdp)
    if (!result.ok) return { success: false, error: result.error, connected: true }
    return { success: true, connected: true }
  } catch (e) {
    console.error('[inbound] sync en échec', { userId: user.id }, e)
    return { success: false, error: friendlyPdpError(e), connected: true }
  }
}

const setStatusSchema = z.object({
  inboundId: z.string().uuid(),
  action: z.enum(['approve', 'refuse']),
  reason: z.string().max(500).optional(),
})

export async function setInboundStatusAction(input: {
  inboundId: string
  action: 'approve' | 'refuse'
  reason?: string
}): Promise<{ success: boolean; error?: string; data?: InboundInvoice }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }

  const parsed = setStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const pdp = await superPdpForUser(supabase, user.id)
  if (!pdp) {
    return { success: false, error: 'Raccordez votre société à la PDP (Réglages → Facturation élec.) pour traiter les factures reçues.' }
  }

  const companyId = await resolveCompanyId(supabase, user.id)
  if (!companyId.ok) return { success: false, error: companyId.error }

  try {
    const result = await setInboundStatus(
      supabase,
      { userId: user.id, companyId: companyId.data },
      pdp,
      parsed.data
    )
    if (!result.ok) return { success: false, error: result.error }
    return { success: true, data: result.data }
  } catch (e) {
    console.error('[inbound] changement de statut en échec', { inboundId: input.inboundId }, e)
    return { success: false, error: friendlyPdpError(e) }
  }
}
