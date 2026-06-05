import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildInvoiceFacturX } from '@/lib/facturx/build'
import { superPdpFromEnv } from '@/lib/pdp'

// Vérifie la conformité d'une facture (schematrons EN16931 / FR-CTC) via la PDP,
// SANS la transmettre. Utilisable sur n'importe quel statut (même brouillon).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const pdp = superPdpFromEnv()
  if (!pdp) {
    return NextResponse.json({ error: 'PDP non configurée sur la plateforme.' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (!company) return NextResponse.json({ error: 'Entreprise non configurée' }, { status: 400 })

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, client:clients(*), items:invoice_items(*)')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })

  try {
    const facturX = await buildInvoiceFacturX(invoice, company)
    const result = await pdp.validateInvoice({ facturX, fileName: `${invoice.number}.pdf` })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la validation' },
      { status: 500 }
    )
  }
}
