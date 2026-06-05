import { renderToBuffer } from '@react-pdf/renderer'
import sharp from 'sharp'
import { InvoiceTemplate } from '@/lib/pdf/invoice-template'
import { generateFacturXXml } from '@/lib/facturx/xml-generator'
import { embedFacturX } from '@/lib/facturx/embed'
import type { InvoiceWithRelations, Company } from '@/types/database'

// Génère le PDF Factur-X (PDF/A-3 + XML CII embarqué) d'une facture.
// Source unique réutilisée par toute transmission (Chorus Pro B2G, PDP B2B) et la
// validation de conformité.
export async function buildInvoiceFacturX(
  invoice: InvoiceWithRelations,
  company: Company
): Promise<Buffer> {
  const companyWithLogo = { ...company }

  // Logo en base64 (le template PDF ne sait pas charger une URL distante).
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(InvoiceTemplate({ invoice: invoice as any, company: companyWithLogo }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xmlContent = generateFacturXXml(invoice as any, company)
  return embedFacturX(Buffer.from(pdfBuffer), xmlContent)
}
