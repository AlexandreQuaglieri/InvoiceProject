'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Encart affiché sur Factures / Devis quand aucun client n'existe : impossible de
// facturer sans client. Explique le bouton grisé et redirige vers la création.
export function NoClientsNotice({ context }: { context: 'invoice' | 'quote' }) {
  const t = useTranslations('clients')
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('noClient.title')}</CardTitle>
        <CardDescription>{t(`noClient.${context}`)}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/clients">
            <Users className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('noClient.cta')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
