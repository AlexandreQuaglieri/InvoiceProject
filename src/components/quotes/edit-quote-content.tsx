'use client'

// Édition d'un devis : valeurs initiales lues dans le store live (useLiveQuote),
// clients via useLiveClients — aucun fetch RSC, zéro actualisation.
import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EditQuoteForm } from '@/components/quotes/edit-quote-form'
import { useLiveQuote, useLiveClients } from '@/lib/realtime'

export function EditQuoteContent({ id }: { id: string }) {
  const router = useRouter()
  const quote = useLiveQuote(id)
  const clients = useLiveClients()

  // Seuls les brouillons sont modifiables : retour à la fiche sinon.
  useEffect(() => {
    if (quote && quote.status !== 'draft') {
      router.replace(`/quotes/${id}`)
    }
  }, [quote, id, router])

  if (!quote) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/quotes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Devis non trouvé</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Ce devis n&apos;existe pas ou a été supprimé.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (quote.status !== 'draft') {
    // La redirection est en cours (useEffect) — rien à afficher.
    return null
  }

  return (
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
  )
}
