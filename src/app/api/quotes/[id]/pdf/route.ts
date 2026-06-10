import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { QuoteTemplate } from '@/lib/pdf/quote-template'
import { rateLimit } from '@/lib/rate-limit'
import type { QuoteWithRelations } from '@/types/database'
import sharp from 'sharp'

export async function GET(
  request: NextRequest,
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

  if (!(await rateLimit('pdf', user.id, { max: 30, windowSeconds: 60 }))) {
    return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter une minute.' }, { status: 429 })
  }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'Entreprise non configurée' }, { status: 400 })
  }

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select(`
      *,
      client:clients(*),
      items:quote_items(*)
    `)
    .eq('id', id)
    .eq('company_id', company.id)
    .single<QuoteWithRelations>()

  if (quoteError || !quote) {
    return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 })
  }

  try {
    const companyWithLogo = { ...company }
    if (company.logo_url) {
      try {
        const logoResponse = await fetch(company.logo_url)
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer()
          const pngBuffer = await sharp(Buffer.from(logoBuffer)).png().toBuffer()
          companyWithLogo.logo_url = `data:image/png;base64,${pngBuffer.toString('base64')}`
        }
      } catch {
        companyWithLogo.logo_url = null
      }
    }

    const pdfBuffer = await renderToBuffer(
      QuoteTemplate({ quote, company: companyWithLogo })
    )

    const fileName = `devis_${quote.quote_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Error generating quote PDF:', error)
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF' }, { status: 500 })
  }
}
