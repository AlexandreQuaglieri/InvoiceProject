// Domaine « entreprise » : recherche externe (API gouv) + lecture de la fiche entreprise de l'utilisateur.
import { type DbClient, type Ctx, type ServiceResult, ok, err } from './core'
import type { Company } from '@/types/database'

// Lit la fiche entreprise de l'utilisateur connecté.
export async function getInfo(supabase: DbClient, ctx: Ctx): Promise<ServiceResult<Company>> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (error) return err(error.message)
  if (!data) {
    return err("Aucune entreprise configurée. Complète la fiche entreprise dans l'application.")
  }
  return ok(data as Company)
}

// Recherche d'entreprise française via l'API gouvernementale (recherche-entreprises).
// Pur fetch, sans Supabase — utilisé par l'assistant IA pour pré-remplir un client pro.
export type CompanySearchResult = {
  name: string
  siren: string
  siret: string
  address: string
  postal_code: string
  city: string
  vat_number: string
}

export async function searchCompany(
  query: string
): Promise<{ results: CompanySearchResult[]; total: number } | { error: string }> {
  try {
    const cleanQuery = query.trim()
    const isNumeric = /^\d+$/.test(cleanQuery.replace(/\s/g, ''))

    let url: string
    if (isNumeric && cleanQuery.replace(/\s/g, '').length >= 9) {
      const siret = cleanQuery.replace(/\s/g, '')
      url = `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=5`
    } else {
      url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(cleanQuery)}&page=1&per_page=5`
    }

    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      return { error: `Erreur lors de la recherche (${response.status})` }
    }

    const data = await response.json()
    if (!data.results || data.results.length === 0) {
      return { error: 'Aucune entreprise trouvée' }
    }

    const results: CompanySearchResult[] = data.results
      .slice(0, 5)
      .map(
        (company: {
          nom_complet?: string
          nom_raison_sociale?: string
          siren?: string
          siege?: { siret?: string; adresse?: string; code_postal?: string; libelle_commune?: string }
        }) => {
          const siege = company.siege || {}
          const siren = company.siren || ''
          const siret = siege.siret || ''

          let vatNumber = ''
          if (siren) {
            const key = (12 + 3 * (parseInt(siren) % 97)) % 97
            vatNumber = `FR${key.toString().padStart(2, '0')}${siren}`
          }

          return {
            name: company.nom_complet || company.nom_raison_sociale || 'Nom inconnu',
            siren,
            siret,
            address: siege.adresse || '',
            postal_code: siege.code_postal || '',
            city: siege.libelle_commune || '',
            vat_number: vatNumber,
          }
        }
      )

    return { results, total: data.total_results }
  } catch {
    return { error: "Erreur lors de la recherche d'entreprise" }
  }
}
