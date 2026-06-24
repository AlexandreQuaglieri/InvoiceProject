import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { decryptSecretOrNull } from '@/lib/crypto'
import { searchCompanies, type CompanyCandidate } from '@/lib/company/sirene'
import type { CompanyFormData } from '@/lib/validations/company'

// Recherche d'entreprise par nom / SIREN sur la base officielle (SIRENE).
// L'assistant cherche à la place de l'utilisateur :
//   1. recherche directe (nom propre / SIREN tapé) ;
//   2. si rien et que la saisie est une phrase, l'IA en extrait le nom/SIREN
//      et on relance la recherche officielle (« j'ai une EI au nom de … »).
// `extras` = infos comprises du texte mais absentes de SIRENE (nom commercial)
// + email du compte, à fusionner dans la fiche préremplie.

// Affine une saisie « langage naturel » en termes de recherche.
async function refineQuery(
  text: string,
  apiKey: string
): Promise<{ name?: string; siren?: string; trade_name?: string } | null> {
  try {
    const anthropic = new Anthropic({ apiKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: `Extrais l'identité de l'ENTREPRISE française décrite, pour une recherche dans l'annuaire officiel. Réponds UNIQUEMENT par un objet JSON (aucun texte autour) : {"name": "raison sociale, ou nom et prénom du dirigeant pour une entreprise individuelle", "siren": "9 chiffres si présents", "trade_name": "nom commercial si mentionné"}. Omets toute clé inconnue.\n\nTexte : """${text}"""`,
        },
      ],
    })
    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    let s = raw.trim()
    if (s.startsWith('```json')) s = s.slice(7)
    else if (s.startsWith('```')) s = s.slice(3)
    if (s.endsWith('```')) s = s.slice(0, -3)
    return JSON.parse(s.trim()) as { name?: string; siren?: string; trade_name?: string }
  } catch (e) {
    console.error('[company-search] refine IA en échec', e)
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
  if (q.length < 3) return NextResponse.json({ success: true, candidates: [], extras: {} })

  // Préremplit l'email du compte (la base publique ne fournit pas l'email).
  const extras: Partial<CompanyFormData> = user.email ? { email: user.email } : {}

  // 1. Recherche directe (nom propre / SIREN).
  let candidates: CompanyCandidate[] = await searchCompanies(q, { limit: 8 })

  // 2. Rien trouvé + saisie comportant du texte → l'IA comprend, on recherche à nouveau.
  if (candidates.length === 0 && /[a-zA-Z]/.test(q)) {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('claude_api_key')
      .eq('user_id', user.id)
      .single()
    const apiKey = decryptSecretOrNull(settings?.claude_api_key) || process.env.ANTHROPIC_API_KEY

    if (apiKey) {
      const refined = await refineQuery(q, apiKey)
      if (refined) {
        if (refined.trade_name) extras.trade_name = String(refined.trade_name).trim()
        const sirenDigits = refined.siren ? String(refined.siren).replace(/\D/g, '') : ''
        const refinedQuery = sirenDigits.length === 9 ? sirenDigits : refined.name?.trim() || ''
        if (refinedQuery) candidates = await searchCompanies(refinedQuery, { limit: 8 })
      }
    }
  }

  return NextResponse.json({ success: true, candidates, extras })
}
