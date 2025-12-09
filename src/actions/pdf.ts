'use server'

import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getInvoice } from './invoices'
import { getCompany } from './company'
import { InvoiceTemplate } from '@/lib/pdf/invoice-template'
import { revalidatePath } from 'next/cache'

export async function generateInvoicePdf(
  invoiceId: string
): Promise<{ success: boolean; error?: string; url?: string }> {
  const supabase = await createClient()

  // Récupérer la facture et l'entreprise
  const invoice = await getInvoice(invoiceId)
  if (!invoice) {
    return { success: false, error: 'Facture non trouvée' }
  }

  const company = await getCompany()
  if (!company) {
    return { success: false, error: 'Entreprise non configurée' }
  }

  try {
    // Générer le PDF
    const pdfBuffer = await renderToBuffer(
      InvoiceTemplate({ invoice, company })
    )

    // Nom du fichier
    const fileName = `${invoice.number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    const filePath = `invoices/${company.id}/${fileName}`

    // Upload vers Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError)
      return { success: false, error: 'Erreur lors de l\'upload du PDF' }
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    // Mettre à jour la facture avec l'URL du PDF
    await supabase
      .from('invoices')
      .update({ pdf_url: urlData.publicUrl })
      .eq('id', invoiceId)

    revalidatePath(`/invoices/${invoiceId}`)
    return { success: true, url: urlData.publicUrl }
  } catch (error) {
    console.error('Error generating PDF:', error)
    return { success: false, error: 'Erreur lors de la génération du PDF' }
  }
}

export async function downloadInvoicePdf(
  invoiceId: string
): Promise<{ success: boolean; error?: string; buffer?: Buffer; fileName?: string }> {
  // Récupérer la facture et l'entreprise
  const invoice = await getInvoice(invoiceId)
  if (!invoice) {
    return { success: false, error: 'Facture non trouvée' }
  }

  const company = await getCompany()
  if (!company) {
    return { success: false, error: 'Entreprise non configurée' }
  }

  try {
    // Générer le PDF
    const pdfBuffer = await renderToBuffer(
      InvoiceTemplate({ invoice, company })
    )

    const fileName = `${invoice.number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    return {
      success: true,
      buffer: Buffer.from(pdfBuffer),
      fileName,
    }
  } catch (error) {
    console.error('Error generating PDF:', error)
    return { success: false, error: 'Erreur lors de la génération du PDF' }
  }
}
