'use server'

import { after } from 'next/server'
import { headers } from 'next/headers'
import { leadSchema, type LeadInput } from '@/lib/validations/lead'
import { createLead } from '@/lib/services/leads'
import { rateLimit } from '@/lib/rate-limit'
import { emitHubEvent, ensureOrg, LEAD_EVENT } from '@/lib/notifications/hub'

// Capture d'email publique (quiz réforme) — pas d'auth : Zod + rate limit IP.
export async function submitLead(input: LeadInput): Promise<{ success: boolean; error?: string }> {
  const parsed = leadSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Adresse email invalide.' }
  }

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'
  const allowed = await rateLimit('lead-submit', ip, { max: 5, windowSeconds: 3600 })
  if (!allowed) {
    return { success: false, error: 'Trop de tentatives. Réessayez dans une heure.' }
  }

  const result = await createLead(parsed.data)
  if (!result.ok) {
    return { success: false, error: result.error }
  }

  // Émission hub (best-effort, hors chemin critique). Le destinataire « member »
  // est le lead lui-même : c'est lui que le workflow checklist doit atteindre.
  // La notification interne (admin) se configure côté hub (canal admin).
  const lead = parsed.data
  after(async () => {
    try {
      const orgId = await ensureOrg()
      if (!orgId) return
      await emitHubEvent({
        event: LEAD_EVENT,
        orgId,
        recipients: [{ email: lead.email }],
        payload: {
          email: lead.email,
          quiz_who: lead.quizWho ?? null,
          quiz_billing: lead.quizBilling ?? null,
          locale: lead.locale ?? null,
        },
      })
    } catch (e) {
      console.error('[leads] notification hub en échec', e)
    }
  })

  return { success: true }
}
