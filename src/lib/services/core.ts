// Socle de la couche services : logique métier unique partagée par l'assistant
// IA in-app (api/chat) et le serveur MCP. Les routes ne font que de la présentation
// (JSON pour le chat, markdown pour MCP) au-dessus de ces fonctions.
//
// Scoping : on filtre TOUJOURS explicitement par company_id (clients, factures,
// devis). C'est le dénominateur commun sûr : ça fonctionne aussi bien avec
// le client SSR (RLS de l'utilisateur) qu'avec le client admin (service_role, bypass RLS).
import type { SupabaseClient } from '@supabase/supabase-js'

export type DbClient = SupabaseClient

// Contexte d'exécution résolu en amont par la route appelante.
export type Ctx = { userId: string; companyId: string }

// Résultat uniforme : pas de JSON string ni de markdown ici, juste des données typées.
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

export function err(error: string): ServiceResult<never> {
  return { ok: false, error }
}

// Résout l'entreprise de l'utilisateur (une seule entreprise par compte).
export async function resolveCompanyId(
  supabase: DbClient,
  userId: string
): Promise<ServiceResult<string>> {
  const { data, error } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return err(`Erreur base de données: ${error.message}`)
  if (!data) {
    return err(
      "Aucune entreprise configurée pour ce compte. Ouvre l'application et complète la fiche entreprise (menu « Entreprise ») avant d'utiliser cet outil."
    )
  }
  return ok(data.id as string)
}

// Récupère (ou crée) les paramètres de numérotation des factures.
export async function getOrCreateUserSettings(
  supabase: DbClient,
  userId: string
): Promise<{ invoice_prefix: string; invoice_next_number: number } | null> {
  const { data } = await supabase
    .from('user_settings')
    .select('invoice_prefix, invoice_next_number')
    .eq('user_id', userId)
    .maybeSingle()

  if (data) return data as { invoice_prefix: string; invoice_next_number: number }

  const { data: created, error } = await supabase
    .from('user_settings')
    .insert({ user_id: userId, invoice_prefix: 'FAC', invoice_next_number: 1 })
    .select('invoice_prefix, invoice_next_number')
    .single()

  if (error) return null
  return created as { invoice_prefix: string; invoice_next_number: number }
}

// Numéro de devis suivant au format D-YYYY-NNN, par entreprise.
// On prend le max numérique des numéros de l'année (et non le dernier
// created_at) : robuste aux suppressions et aux créations désordonnées.
export async function getNextQuoteNumber(supabase: DbClient, companyId: string): Promise<string> {
  const year = new Date().getFullYear()

  const { data } = await supabase
    .from('quotes')
    .select('quote_number')
    .eq('company_id', companyId)
    .like('quote_number', `D-${year}-%`)

  const max = (data ?? []).reduce((acc, row) => {
    const match = (row.quote_number as string).match(/^D-\d{4}-(\d+)$/)
    return match ? Math.max(acc, parseInt(match[1], 10)) : acc
  }, 0)

  return `D-${year}-${String(max + 1).padStart(3, '0')}`
}
