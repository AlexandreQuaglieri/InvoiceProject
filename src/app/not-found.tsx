// Page 404 globale (RSC) : textes i18n + retour vers le tableau de bord.
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'

export default async function NotFound() {
  const t = await getTranslations('notFound')

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <p className="text-7xl font-bold tracking-tight text-muted-foreground">404</p>
        <h1 className="mt-4 text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('description')}</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">{t('backHome')}</Link>
        </Button>
      </div>
    </div>
  )
}
