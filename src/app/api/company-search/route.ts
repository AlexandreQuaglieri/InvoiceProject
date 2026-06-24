import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { searchCompanies } from '@/lib/company/sirene'

// Recherche d'entreprise par nom ou SIREN/SIRET sur la base officielle (SIRENE).
// Lecture seule, source autoritaire de l'État — l'assistant cherche à la place
// de l'utilisateur. Auth + rate-limit (courtoisie envers l'API publique).
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
  if (q.length < 3) return NextResponse.json({ success: true, candidates: [] })

  const candidates = await searchCompanies(q, { limit: 8 })
  return NextResponse.json({ success: true, candidates })
}
