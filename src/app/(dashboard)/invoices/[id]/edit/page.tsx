import { EditInvoiceForm } from '@/components/invoices/edit-invoice-form'

interface EditInvoicePageProps {
  params: Promise<{ id: string }>
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = await params

  return <EditInvoiceForm invoiceId={id} />
}
