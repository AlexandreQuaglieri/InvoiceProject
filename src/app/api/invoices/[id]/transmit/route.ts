import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFacturXXml } from '@/lib/facturx/xml-generator'
import { deposerFluxFacturX } from '@/lib/chorus-pro/client'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Credentials plateforme depuis les variables d'environnement
  const clientId = process.env.CHORUS_PRO_CLIENT_ID
  const clientSecret = process.env.CHORUS_PRO_CLIENT_SECRET
  const login = process.env.CHORUS_PRO_LOGIN
  const password = process.env.CHORUS_PRO_PASSWORD
  const sandbox = process.env.CHORUS_PRO_SANDBOX !== 'false'

  if (!clientId || !clientSecret || !login || !password) {
    return NextResponse.json(
      { error: 'Chorus Pro non configuré sur la plateforme.' },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!company) {
    return NextResponse.json({ error: 'Entreprise non configurée' }, { status: 400 })
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, client:clients(*), items:invoice_items(*)')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
  }

  if (invoice.status === 'draft') {
    return NextResponse.json(
      { error: "Impossible de transmettre un brouillon. Finalisez la facture d'abord." },
      { status: 400 }
    )
  }

  try {
    const xmlContent = generateFacturXXml(invoice as any, company)

    const result = await deposerFluxFacturX(
      { clientId, clientSecret, login, password, sandbox },
      xmlContent,
      invoice.number
    )

    console.log('[Chorus Pro] Réponse complète:', JSON.stringify(result, null, 2))

    return NextResponse.json({
      success: true,
      numeroFluxDepot: result.numeroFluxDepot,
      dateDepot: result.dateDepot,
      _debug: result,
    })
  } catch (error) {
    console.error('Erreur transmission Chorus Pro:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la transmission' },
      { status: 500 }
    )
  }
}
