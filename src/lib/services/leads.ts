// Leads marketing — visiteurs anonymes (pas de Ctx). La table est deny-all en
// RLS : seule cette fonction (client admin) écrit, derrière la server action
// rate-limitée. Idempotent : re-soumettre le même email met à jour les réponses
// du quiz au lieu de créer un doublon.
import { createAdminClient } from '@/lib/supabase/admin'
import { ok, err, type ServiceResult } from './core'
import type { LeadInput } from '@/lib/validations/lead'

export async function createLead(input: LeadInput): Promise<ServiceResult<{ id: string }>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('leads')
    .upsert(
      {
        email: input.email,
        source: 'quiz-reforme',
        quiz_who: input.quizWho ?? null,
        quiz_billing: input.quizBilling ?? null,
        locale: input.locale ?? null,
      },
      { onConflict: 'email,source' }
    )
    .select('id')
    .single()

  if (error) {
    console.error('[leads] enregistrement en échec', error)
    return err("Impossible d'enregistrer votre email. Réessayez.")
  }
  return ok({ id: data.id as string })
}
