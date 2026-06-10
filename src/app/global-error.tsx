'use client'

// Error boundary racine : remplace le layout root, doit rendre <html>/<body>.
// Le provider next-intl n'est plus disponible ici → texte français statique.
import { useEffect } from 'react'
import './globals.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erreur de page', error)
  }, [error])

  return (
    <html lang="fr">
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Réessayez ; si le problème persiste, contactez le support.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
