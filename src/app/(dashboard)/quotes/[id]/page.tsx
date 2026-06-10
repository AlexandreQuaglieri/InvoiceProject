import { QuoteDetailContent } from '@/components/quotes/quote-detail-content'

interface QuotePageProps {
  params: Promise<{ id: string }>
}

// RSC minimal : la donnée (devis + entreprise) vient du store live seedé par le layout.
export default async function QuotePage({ params }: QuotePageProps) {
  const { id } = await params
  return <QuoteDetailContent id={id} />
}
