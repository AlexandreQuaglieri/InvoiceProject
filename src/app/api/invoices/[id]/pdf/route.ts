import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoiceTemplate } from '@/lib/pdf/invoice-template'
import { generateFacturXXml } from '@/lib/facturx/xml-generator'
import { embedFacturX } from '@/lib/facturx/embed'
import sharp from 'sharp'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Vérifier l'authentification
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Récupérer l'entreprise de l'utilisateur
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (companyError || !company) {
    return NextResponse.json(
      { error: 'Entreprise non configurée' },
      { status: 400 }
    )
  }

  // Récupérer la facture avec le client et les lignes
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('id', id)
    .eq('company_id', company.id)
    .single()

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
  }

  try {
    // Si l'entreprise a un logo, le convertir en base64 PNG pour react-pdf
    let companyWithLogo = { ...company }
    if (company.logo_url) {
      try {
        const logoResponse = await fetch(company.logo_url)
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer()

          // Convertir en PNG avec sharp (supporte WebP, JPG, PNG, etc.)
          const pngBuffer = await sharp(Buffer.from(logoBuffer))
            .png()
            .toBuffer()

          const base64 = pngBuffer.toString('base64')
          companyWithLogo.logo_url = `data:image/png;base64,${base64}`
        }
      } catch (logoError) {
        console.error('Error processing logo:', logoError)
        // Continuer sans logo en cas d'erreur
        companyWithLogo.logo_url = null
      }
    }

    // Générer le PDF visuel
    const pdfBuffer = await renderToBuffer(
      InvoiceTemplate({ invoice: invoice as any, company: companyWithLogo })
    )

    // Générer le XML Factur-X et l'embarquer dans le PDF (PDF/A-3)
    const xmlContent = generateFacturXXml(invoice as any, company)
    const facturXBuffer = await embedFacturX(Buffer.from(pdfBuffer), xmlContent)

    // Nom du fichier
    const fileName = `${invoice.number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    return new NextResponse(new Uint8Array(facturXBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF' },
      { status: 500 }
    )
  }
}
