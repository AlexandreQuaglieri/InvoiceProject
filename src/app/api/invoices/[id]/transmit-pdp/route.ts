import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { superPdpForRequest, friendlyPdpError } from '@/lib/pdp'
import { rateLimit } from '@/lib/rate-limit'
import { resolveCompanyId, transmitInvoice, syncInvoiceLifecycle } from '@/lib/services'

// Transmet une facture (Factur-X) en B2B via la PDP (Super PDP). Boundary fin :
// auth → rate-limit → résolution du contexte → service einvoicing.
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
  if (!pdp) {
    return NextResponse.json({ error: 'PDP non configurée sur la plateforme.' }, { status: 503 })
  }

  const companyId = await resolveCompanyId(supabase, user.id)
  if (!companyId.ok) return NextResponse.json({ error: companyId.error }, { status: 400 })

  try {
    const result = await transmitInvoice(
      supabase,
      { userId: user.id, companyId: companyId.data },
      pdp,
      { invoiceId: id }
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    // Synchronise le premier statut PDP hors chemin critique (best-effort observé).
    if (!result.data.alreadyTransmitted) {
      after(async () => {
        try {
          await syncInvoiceLifecycle(
            supabase,
            { userId: user.id, companyId: companyId.data },
            pdp,
            { invoiceId: id }
          )
        } catch (e) {
          console.error('[einvoicing] sync post-transmission en échec', { invoiceId: id }, e)
        }
      })
    }

    return NextResponse.json({
      success: true,
      depositId: result.data.depositId,
      transmittedAt: result.data.transmittedAt,
      alreadyTransmitted: result.data.alreadyTransmitted,
    })
  } catch (error) {
    return NextResponse.json({ error: friendlyPdpError(error) }, { status: 500 })
  }
}
