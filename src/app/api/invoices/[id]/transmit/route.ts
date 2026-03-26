import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoiceTemplate } from '@/lib/pdf/invoice-template'
import { generateFacturXXml } from '@/lib/facturx/xml-generator'
import { embedFacturX } from '@/lib/facturx/embed'
import { deposerFluxFacturX } from '@/lib/chorus-pro/client'
import sharp from 'sharp'

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
    // Générer le logo en base64 si présent
    let companyWithLogo = { ...company }
    if (company.logo_url) {
      try {
        const logoResponse = await fetch(company.logo_url)
        if (logoResponse.ok) {
          const pngBuffer = await sharp(Buffer.from(await logoResponse.arrayBuffer())).png().toBuffer()
          companyWithLogo.logo_url = `data:image/png;base64,${pngBuffer.toString('base64')}`
        }
      } catch {
        companyWithLogo.logo_url = null
      }
    }

    // Générer le PDF Factur-X complet (PDF + XML embarqué)
    const pdfBuffer = await renderToBuffer(
      InvoiceTemplate({ invoice: invoice as any, company: companyWithLogo })
    )
    const xmlContent = generateFacturXXml(invoice as any, company)
    const facturXBuffer = await embedFacturX(Buffer.from(pdfBuffer), xmlContent)

    const result = await deposerFluxFacturX(
      { clientId, clientSecret, login, password, sandbox },
      facturXBuffer,
      invoice.number
    )

    console.log('[Chorus Pro] Réponse:', JSON.stringify(result))
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
