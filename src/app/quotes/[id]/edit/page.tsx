import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { EditQuoteForm } from '@/components/quotes/edit-quote-form'
import { getQuote } from '@/actions/quotes'
import { getClients } from '@/actions/clients'

interface EditQuotePageProps {
  params: Promise<{ id: string }>
}

export default async function EditQuotePage({ params }: EditQuotePageProps) {
  const { id } = await params
  const quote = await getQuote(id)
  const clients = await getClients()

  if (!quote) {
    notFound()
  }

  if (quote.status !== 'draft') {
    redirect(`/quotes/${id}`)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/quotes/${quote.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Modifier {quote.quote_number}
            </h1>
            <p className="text-muted-foreground">
              Modifiez les informations du devis.
            </p>
          </div>
        </div>

        <EditQuoteForm quote={quote} clients={clients} />
      </div>
    </DashboardLayout>
  )
}
