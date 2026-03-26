import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFacturXXml } from '@/lib/facturx/xml-generator'
import { deposerFluxFacturX } from '@/lib/chorus-pro/client'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Récupérer les paramètres Chorus Pro
  const { data: settings } = await supabase
    .from('user_settings')
    .select('chorus_pro_client_id, chorus_pro_client_secret, chorus_pro_login, chorus_pro_password, chorus_pro_sandbox')
    .eq('user_id', user.id)
    .single()

  if (
    !settings?.chorus_pro_client_id ||
    !settings?.chorus_pro_client_secret ||
    !settings?.chorus_pro_login ||
    !settings?.chorus_pro_password
  ) {
    return NextResponse.json(
      { error: 'Paramètres Chorus Pro non configurés. Rendez-vous dans Paramètres → Chorus Pro.' },
      { status: 400 }
    )
  }

  // Récupérer l'entreprise
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!company) {
    return NextResponse.json({ error: 'Entreprise non configurée' }, { status: 400 })
  }

  // Récupérer la facture avec client et lignes
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
      { error: 'Impossible de transmettre un brouillon. Finalisez la facture d\'abord.' },
      { status: 400 }
    )
  }

  try {
    const xmlContent = generateFacturXXml(invoice as any, company)

    const result = await deposerFluxFacturX(
      {
        clientId: settings.chorus_pro_client_id,
        clientSecret: settings.chorus_pro_client_secret,
        login: settings.chorus_pro_login,
        password: settings.chorus_pro_password,
        sandbox: settings.chorus_pro_sandbox ?? true,
      },
      xmlContent,
      invoice.number
    )

    return NextResponse.json({
      success: true,
      numeroFluxDepot: result.numeroFluxDepot,
      dateDepot: result.dateDepot,
    })
  } catch (error) {
    console.error('Erreur transmission Chorus Pro:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la transmission' },
      { status: 500 }
    )
  }
}
