import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { decryptSecretOrNull } from '@/lib/crypto'
import { searchCompanies, type CompanyCandidate } from '@/lib/company/sirene'
import type { CompanyFormData } from '@/lib/validations/company'

// Recherche d'entreprise par nom / SIREN sur la base officielle (SIRENE).
// L'assistant cherche à la place de l'utilisateur, avec INITIATIVE :
//   1. recherche directe dans l'annuaire (nom propre / SIREN exact) ;
//   2. si rien (saisie approximative, nom collé type « rocalys esport » que la
//      tokenisation officielle rate), l'IA fait une VRAIE recherche web — comme
//      un humain sur Google — pour résoudre le SIREN, puis on récupère la donnée
//      OFFICIELLE par SIREN (annuaire). Repli sans web si la recherche web échoue.
// `extras` : email du compte + nom commercial compris, à fusionner sur la fiche.

type Resolved = {
  siren?: string
  name?: string
  trade_name?: string
  // Coordonnées trouvées sur le web (absentes de la base officielle SIRENE).
  email?: string
  phone?: string
  website?: string
}

// Dernier objet JSON équilibré présent dans le texte (Claude le met en fin).
function extractJson(text: string): Resolved | null {
  const end = text.lastIndexOf('}')
  if (end === -1) return null
  let depth = 0
  for (let i = end; i >= 0; i--) {
    if (text[i] === '}') depth++
    else if (text[i] === '{') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(i, end + 1)) as Resolved
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function joinText(message: Anthropic.Message): string {
  return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('\n')
}

async function resolveCompany(query: string, apiKey: string): Promise<Resolved | null> {
  const anthropic = new Anthropic({ apiKey })

  // 1. L'IA prend l'initiative : recherche web → SIREN.
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [
        {
          role: 'user',
          content: `Tu aides à identifier une entreprise ou association FRANÇAISE pour la facturation. À partir de la saisie (souvent approximative) de l'utilisateur, trouve via une recherche web (sources : annuaire-entreprises.data.gouv.fr, pappers.fr, societe.com, site officiel de l'entité) :
- son SIREN (9 chiffres) ;
- et, SEULEMENT si tu les trouves de façon fiable, son email de contact, son téléphone et son site web.
Saisie : "${query}". Termine ta réponse par UN objet JSON sur la dernière ligne : {"siren":"9 chiffres","name":"raison sociale officielle","trade_name":"nom commercial si pertinent","email":"email si trouvé","phone":"téléphone si trouvé","website":"site si trouvé"}. Omets toute clé non trouvée. Si tu n'identifies pas l'entité : {}.`,
        },
      ],
    })
    const parsed = extractJson(joinText(message))
    if (parsed && (parsed.siren || parsed.name)) return parsed
  } catch (e) {
    console.error('[company-search] résolution web en échec', e)
  }

  // 2. Repli sans web (web search indisponible) : l'IA extrait juste le nom.
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: `Extrais l'identité de l'entreprise française décrite. Réponds UNIQUEMENT par un JSON : {"name":"raison sociale ou nom du dirigeant","siren":"9 chiffres si présents","trade_name":"nom commercial si mentionné"}. Texte : """${query}"""`,
        },
      ],
    })
    return extractJson(joinText(message))
  } catch (e) {
    console.error('[company-search] refine sans web en échec', e)
    return null
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  if (!(await rateLimit('company-search', user.id, { max: 20, windowSeconds: 60 }))) {
    return NextResponse.json({ error: 'Trop de requêtes. Patientez un instant.' }, { status: 429 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const target = request.nextUrl.searchParams.get('for') === 'client' ? 'client' : 'company'
  if (q.length < 3) return NextResponse.json({ success: true, candidates: [], extras: {} })

  // `for=company` (défaut, sa propre fiche) : on préremplit l'email DU COMPTE.
  // `for=client` : jamais l'email du compte — ce sont les coordonnées DU CLIENT.
  const extras: Partial<CompanyFormData> =
    target === 'company' && user.email ? { email: user.email } : {}

  // 1. Recherche directe (nom propre / SIREN).
  let candidates: CompanyCandidate[] = await searchCompanies(q, { limit: 8 })

  // 2. Rien trouvé + saisie comportant du texte → l'IA cherche (web) et résout.
  if (candidates.length === 0 && /[a-zA-Z]/.test(q)) {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('claude_api_key')
      .eq('user_id', user.id)
      .single()
    const apiKey = decryptSecretOrNull(settings?.claude_api_key) || process.env.ANTHROPIC_API_KEY

    if (apiKey) {
      const resolved = await resolveCompany(q, apiKey)
      if (resolved) {
        // Coordonnées web (absentes de SIRENE) à fusionner sur la fiche.
        if (resolved.trade_name) extras.trade_name = String(resolved.trade_name).trim()
        if (resolved.phone) extras.phone = String(resolved.phone).trim()
        if (target === 'client') {
          if (resolved.email) extras.email = String(resolved.email).trim()
        } else if (resolved.website) {
          extras.website = String(resolved.website).trim()
        }
        const sirenDigits = resolved.siren ? String(resolved.siren).replace(/\D/g, '') : ''
        if (sirenDigits.length === 9) {
          candidates = await searchCompanies(sirenDigits, { limit: 8 })
        } else if (resolved.name) {
          candidates = await searchCompanies(String(resolved.name).trim(), { limit: 8 })
        }
      }
    }
  }

  return NextResponse.json({ success: true, candidates, extras })
}
