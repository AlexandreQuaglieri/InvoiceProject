import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { superPdpForRequest, friendlyPdpError } from '@/lib/pdp'
import { rateLimit } from '@/lib/rate-limit'
import { resolveCompanyId, ereportB2cTransaction } from '@/lib/services'

// Déclare une facture B2C (vente à un particulier) en e-reporting via la PDP.
// Boundary fin : auth → rate-limit → résolution du contexte → service einvoicing.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  if (!(await rateLimit('transmit', user.id, { max: 10, windowSeconds: 60 }))) {
    return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter une minute.' }, { status: 429 })
  }

  const pdp = await superPdpForRequest(supabase, user.id)
  if (!pdp) return NextResponse.json({ error: 'PDP non configurée.' }, { status: 503 })

  const companyId = await resolveCompanyId(supabase, user.id)
  if (!companyId.ok) return NextResponse.json({ error: companyId.error }, { status: 400 })

  try {
    const result = await ereportB2cTransaction(
      supabase,
      { userId: user.id, companyId: companyId.data },
      pdp,
      { invoiceId: id }
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({
      success: true,
      id: result.data.id,
      alreadyReported: result.data.alreadyReported,
    })
  } catch (error) {
    return NextResponse.json({ error: friendlyPdpError(error) }, { status: 500 })
  }
}
