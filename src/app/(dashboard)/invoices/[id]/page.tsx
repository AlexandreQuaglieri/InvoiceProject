import { InvoiceContent } from '@/components/invoices/invoice-content'
import { createClient } from '@/lib/supabase/server'
import { getPdpConnection } from '@/lib/pdp'

interface InvoicePageProps {
  params: Promise<{ id: string }>
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const pdpConnected = user ? (await getPdpConnection(supabase, user.id)).connected : false

  return <InvoiceContent invoiceId={id} pdpConnected={pdpConnected} />
}
