import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { superPdpForRequest, friendlyPdpError, type PdpB2cTransaction } from '@/lib/pdp'

// Déclare une facture B2C (vente à un particulier) en e-reporting via la PDP
// (POST /v1.beta/b2c_transactions).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .select('*, client:clients(*), items:invoice_items(*)')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })

  if (invoice.client?.type !== 'individual') {
    return NextResponse.json(
      {
        error:
          "L'e-reporting concerne les ventes aux particuliers (B2C). Une facture professionnelle se transmet via la PDP.",
      },
      { status: 400 }
    )
  }
  if (invoice.status === 'draft') {
    return NextResponse.json({ error: 'Finalisez la facture avant de la déclarer.' }, { status: 400 })
  }

  // Agrège la TVA par taux pour les sous-totaux.
  const byRate = new Map<number, { ht: number; vat: number }>()
  for (const item of invoice.items ?? []) {
    const rate = Number(item.vat_rate)
    const cur = byRate.get(rate) ?? { ht: 0, vat: 0 }
    cur.ht += Number(item.total_ht)
    cur.vat += Number(item.total_vat)
    byRate.set(rate, cur)
  }
  const tax_subtotals = [...byRate.entries()].map(([rate, v]) => ({
    tax_percent: String(rate),
    taxable_amount: v.ht.toFixed(2),
    tax_total: v.vat.toFixed(2),
  }))

  const tx: PdpB2cTransaction = {
    category_code: 'TPS1', // prestation de services (défaut)
    currency: 'EUR',
    date: invoice.issue_date,
    role_code: 'SE',
    tax_exclusive_amount: Number(invoice.total_ht).toFixed(2),
    tax_total: Number(invoice.total_vat).toFixed(2),
    tax_subtotals,
  }

  try {
    const result = await pdp.reportB2cTransaction(tx)
    return NextResponse.json({ success: true, id: result.id })
  } catch (error) {
    return NextResponse.json({ error: friendlyPdpError(error) }, { status: 500 })
  }
}
