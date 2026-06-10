import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoiceTemplate } from '@/lib/pdf/invoice-template'
import { generateFacturXXml } from '@/lib/facturx/xml-generator'
import { embedFacturX } from '@/lib/facturx/embed'
import { rateLimit } from '@/lib/rate-limit'
import type { InvoiceWithRelations } from '@/types/database'
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

  if (!(await rateLimit('pdf', user.id, { max: 30, windowSeconds: 60 }))) {
    return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter une minute.' }, { status: 429 })
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
    .single<InvoiceWithRelations>()

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
  }

  try {
    // Si l'entreprise a un logo, le convertir en base64 PNG pour react-pdf
    const companyWithLogo = { ...company }
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
      InvoiceTemplate({ invoice, company: companyWithLogo })
    )

    // Générer le XML Factur-X et l'embarquer dans le PDF (PDF/A-3)
    const xmlContent = generateFacturXXml(invoice, company)
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
