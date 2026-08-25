// ⚠️ Brouillon généré — à faire relire (placeholders à compléter)
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LegalArticle, type LegalSection } from '@/components/marketing/legal-article'
import { fillLegalTokens } from '@/lib/legal-identity'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.cgu')
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: { canonical: '/legal/cgu' },
  }
}

export default async function CguPage() {
  const t = await getTranslations('legal')
  const sections = fillLegalTokens(t.raw('cgu.sections') as LegalSection[])
  const disclaimer = t.raw('common.disclaimer') as string

  return (
    <LegalArticle
      title={t('cgu.title')}
      updated={t('common.updated', { date: t('cgu.updated') })}
      disclaimer={disclaimer || undefined}
      sections={sections}
    />
  )
}
