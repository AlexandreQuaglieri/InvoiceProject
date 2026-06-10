import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { superPdpForRequest, friendlyPdpError } from '@/lib/pdp'
import { resolveCompanyId, syncInvoiceLifecycle } from '@/lib/services'

// Cycle de vie e-invoicing d'une facture transmise : récupère les événements
// auprès de la PDP ET persiste le dernier statut connu (pdp_status) — le
// Realtime propage la mise à jour aux clients ouverts.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const pdp = await superPdpForRequest(supabase, user.id)
  if (!pdp) return NextResponse.json({ error: 'PDP non configurée.' }, { status: 503 })

  const companyId = await resolveCompanyId(supabase, user.id)
  if (!companyId.ok) return NextResponse.json({ error: companyId.error }, { status: 400 })

  try {
    const result = await syncInvoiceLifecycle(
      supabase,
      { userId: user.id, companyId: companyId.data },
      pdp,
      { invoiceId: id }
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 })

    return NextResponse.json(result.data)
  } catch (error) {
    return NextResponse.json({ error: friendlyPdpError(error) }, { status: 500 })
  }
}
