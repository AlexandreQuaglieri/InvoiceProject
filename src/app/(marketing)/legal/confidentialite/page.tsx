// ⚠️ Brouillon généré — à faire relire (placeholders à compléter)
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LegalArticle, type LegalSection } from '@/components/marketing/legal-article'
import { fillLegalTokens } from '@/lib/legal-identity'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.privacy')
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: { canonical: '/legal/confidentialite' },
  }
}

export default async function PrivacyPage() {
  const t = await getTranslations('legal')
  const sections = fillLegalTokens(t.raw('privacy.sections') as LegalSection[])
  const disclaimer = t.raw('common.disclaimer') as string

  return (
    <LegalArticle
      title={t('privacy.title')}
      updated={t('common.updated', { date: t('privacy.updated') })}
      disclaimer={disclaimer || undefined}
      sections={sections}
    />
  )
}
