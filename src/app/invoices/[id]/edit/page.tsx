import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { EditInvoiceForm } from '@/components/invoices/edit-invoice-form'
import { getInvoice } from '@/actions/invoices'
import { getClients } from '@/actions/clients'

interface EditInvoicePageProps {
  params: Promise<{ id: string }>
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = await params
  const invoice = await getInvoice(id)
  const clients = await getClients()

  if (!invoice) {
    notFound()
  }

  // Rediriger si la facture n'est pas un brouillon
  if (invoice.status !== 'draft') {
    redirect(`/invoices/${id}`)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/invoices/${invoice.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Modifier {invoice.number}
            </h1>
            <p className="text-muted-foreground">
              Modifiez les informations de la facture.
            </p>
          </div>
        </div>

        <EditInvoiceForm invoice={invoice} clients={clients} />
      </div>
    </DashboardLayout>
  )
}
