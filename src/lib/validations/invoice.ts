import { z } from 'zod'

export const invoiceStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const
export const vatRates = [0, 5.5, 10, 20] as const

export const invoiceItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'La description est requise'),
  quantity: z.number().min(0.001, 'La quantité doit être positive'),
  unit_price: z.number().min(0, 'Le prix doit être positif'),
  vat_rate: z.number(),
})

export const invoiceSchema = z.object({
  client_id: z.string().min(1, 'Le client est requis'),
  issue_date: z.string(),
  due_date: z.string(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
  discount_type: z.enum(['percentage', 'amount']).optional(),
  discount_value: z.number().optional(),
  items: z.array(invoiceItemSchema).min(1, 'Au moins une ligne est requise'),
})

export type InvoiceItemFormData = z.infer<typeof invoiceItemSchema>
export type InvoiceFormData = z.output<typeof invoiceSchema>
// Type d'entrée du formulaire (avant transformation Zod)
export type InvoiceFormInput = z.input<typeof invoiceSchema>

// Génère le numéro de facture au format YYYYMMDD-XX
export function generateInvoiceNumber(prefix: string, nextNumber: number): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const paddedNumber = String(nextNumber).padStart(2, '0')
  return `${year}${month}${day}-${paddedNumber}`
}

// Calcul les totaux d'une ligne
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  vatRate: number
): { totalHt: number; totalVat: number; totalTtc: number } {
  const totalHt = Math.round(quantity * unitPrice * 100) / 100
  const totalVat = Math.round(totalHt * vatRate) / 100
  const totalTtc = totalHt + totalVat
  return { totalHt, totalVat, totalTtc }
}

// Calcul les totaux de la facture
export function calculateInvoiceTotals(
  items: Array<{ quantity: number; unit_price: number; vat_rate: number }>,
  discountType?: string,
  discountValue?: number
): { totalHt: number; totalVat: number; totalTtc: number } {
  let totalHt = 0
  let totalVat = 0

  for (const item of items) {
    const line = calculateLineTotal(item.quantity, item.unit_price, item.vat_rate)
    totalHt += line.totalHt
    totalVat += line.totalVat
  }

  // Appliquer la remise
  if (discountType === 'percentage' && discountValue && discountValue > 0) {
    const discountAmount = totalHt * discountValue / 100
    totalHt -= discountAmount
    totalVat = Math.round(totalVat * (1 - discountValue / 100) * 100) / 100
  } else if (discountType === 'amount' && discountValue && discountValue > 0) {
    totalHt -= discountValue
  }

  const totalTtc = Math.round((totalHt + totalVat) * 100) / 100
  totalHt = Math.round(totalHt * 100) / 100

  return { totalHt, totalVat, totalTtc }
}
