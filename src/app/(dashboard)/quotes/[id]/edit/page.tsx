import { EditQuoteContent } from '@/components/quotes/edit-quote-content'

interface EditQuotePageProps {
  params: Promise<{ id: string }>
}

// RSC minimal : devis + clients viennent du store live seedé par le layout.
export default async function EditQuotePage({ params }: EditQuotePageProps) {
  const { id } = await params
  return <EditQuoteContent id={id} />
}
