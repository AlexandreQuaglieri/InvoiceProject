import type { CompanyFormData } from '@/lib/validations/company'

// Recherche d'entreprise sur la base officielle de l'État (Annuaire des
// Entreprises / base SIRENE — recherche-entreprises.api.gouv.fr) : gratuite, à
// jour, sans clé. Sert l'assistant « je cherche votre entreprise pour vous » :
// par NOM (texte libre) ou par SIREN/SIRET. Fonction pure côté serveur.

export type CompanyCandidate = {
  siren: string
  // Libellé d'affichage du sélecteur (cas homonymes) — ex. « ATELIER QUATOOLS ».
  name: string
  city: string | null
  // Champs prêts à préremplir le formulaire (mêmes clés que CompanyFormData).
  fields: Partial<CompanyFormData>
}

const SOCIETES = ['sas', 'sasu', 'sarl', 'eurl', 'sa']

// Catégories juridiques INSEE (nature_juridique) → enum de l'application.
function legalFormFromInsee(code: string | undefined): CompanyFormData['legal_form'] | null {
  if (!code) return null
  if (code === '1000') return 'ei'
  if (code === '5498') return 'eurl'
  if (code === '5499') return 'sarl'
  if (code === '5710') return 'sas'
  if (code === '5720') return 'sasu'
  if (code.startsWith('55') || code.startsWith('56')) return 'sa'
  if (code.startsWith('92')) return 'association'
  return null
}

// N° de TVA intracommunautaire français dérivé du SIREN (formule officielle).
function vatNumberFromSiren(siren: string): string {
  const key = (12 + 3 * (parseInt(siren, 10) % 97)) % 97
  return `FR${key.toString().padStart(2, '0')}${siren}`
}

type SireneResult = {
  nom_complet?: string
  nom_raison_sociale?: string
  siren?: string
  nature_juridique?: string
  siege?: {
    siret?: string
    adresse?: string
    code_postal?: string
    libelle_commune?: string
  }
}

function mapResult(r: SireneResult): CompanyCandidate | null {
  const siren = r.siren
  if (!siren || siren.length !== 9) return null
  const name = (r.nom_complet || r.nom_raison_sociale || '').trim()
  if (!name) return null

  const siege = r.siege ?? {}
  const city = siege.libelle_commune ?? null

  const fields: Partial<CompanyFormData> = { name, siren }
  if (siege.siret && siege.siret.length === 14) fields.siret = siege.siret

  const legalForm = legalFormFromInsee(r.nature_juridique)
  if (legalForm) {
    fields.legal_form = legalForm
    // Une société est assujettie à la TVA : on préremplit « réel simplifié ».
    if (SOCIETES.includes(legalForm)) fields.vat_regime = 'reel_simplifie'
  }

  if (siege.adresse) {
    // L'adresse du siège inclut CP + ville : on isole la voie si possible.
    const voie = siege.adresse
      .replace(
        new RegExp(`\\s*${siege.code_postal ?? ''}\\s*${siege.libelle_commune ?? ''}\\s*$`, 'i'),
        ''
      )
      .trim()
    fields.address = voie || siege.adresse
  }
  if (siege.code_postal) fields.postal_code = siege.code_postal
  if (siege.libelle_commune) fields.city = siege.libelle_commune
  fields.vat_number = vatNumberFromSiren(siren)

  return { siren, name, city, fields }
}

// La saisie ne contient QUE des chiffres/espaces et fait 9 (SIREN) ou 14 (SIRET).
function asIdentifier(query: string): string | null {
  const compact = query.replace(/\s/g, '')
  if (!/^\d+$/.test(compact)) return null
  if (compact.length === 9 || compact.length === 14) return compact
  return null
}

export async function searchCompanies(
  query: string,
  opts: { limit?: number } = {}
): Promise<CompanyCandidate[]> {
  const limit = opts.limit ?? 8
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const identifier = asIdentifier(trimmed)
  const q = identifier ?? trimmed

  const params = new URLSearchParams({ q, page: '1', per_page: String(limit) })

  try {
    const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return []

    const data = (await response.json()) as { results?: SireneResult[] }
    const candidates = (data.results ?? [])
      .map(mapResult)
      .filter((c): c is CompanyCandidate => c !== null)

    // Recherche par identifiant : on ne garde que le SIREN exact (zéro homonyme).
    if (identifier) {
      const targetSiren = identifier.substring(0, 9)
      return candidates.filter((c) => c.siren === targetSiren).slice(0, 1)
    }
    return candidates.slice(0, limit)
  } catch (e) {
    console.error('[sirene] recherche en échec', { q }, e)
    return []
  }
}
