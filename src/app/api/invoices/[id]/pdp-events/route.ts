import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { superPdpForRequest } from '@/lib/pdp'

// Récupère le cycle de vie e-invoicing d'une facture transmise via la PDP
// (statuts Déposée / Refusée / Encaissée…), depuis GET /v1.beta/invoice_events.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const pdp = await superPdpForRequest(supabase, user.id)
  if (!pdp) return NextResponse.json({ error: 'PDP non configurée.' }, { status: 503 })

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!company) return NextResponse.json({ error: 'Entreprise non configurée' }, { status: 400 })

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })

  const depositId = (invoice as { pdp_deposit_id?: string | null }).pdp_deposit_id
  if (!depositId) return NextResponse.json({ transmitted: false, events: [] })

  try {
    const events = await pdp.getLifecycle(depositId)
    return NextResponse.json({ transmitted: true, depositId, events })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de récupération du cycle de vie' },
      { status: 500 }
    )
  }
}
