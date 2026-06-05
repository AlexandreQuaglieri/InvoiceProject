import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { superPdpFromEnv } from '@/lib/pdp'

// Télécharge le fichier brut (Factur-X PDF ou XML) d'une facture reçue via la PDP.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const pdp = superPdpFromEnv()
  if (!pdp) return NextResponse.json({ error: 'PDP non configurée.' }, { status: 503 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const buf = await pdp.downloadInvoice(id)
    const isPdf = buf.length > 4 && buf.toString('ascii', 0, 4) === '%PDF'
    const ext = isPdf ? 'pdf' : 'xml'
    const contentType = isPdf ? 'application/pdf' : 'application/xml'
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="facture-recue-${id}.${ext}"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors du téléchargement' },
      { status: 500 }
    )
  }
}
