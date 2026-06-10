// ⚠️ Brouillon généré — à faire relire (placeholders à compléter)
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LegalArticle, type LegalSection } from '@/components/marketing/legal-article'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.mentions')
  return { title: t('metaTitle') }
}

export default async function MentionsLegalesPage() {
  const t = await getTranslations('legal')
  const sections = t.raw('mentions.sections') as LegalSection[]
  const disclaimer = t.raw('common.disclaimer') as string

  return (
    <LegalArticle
      title={t('mentions.title')}
      updated={t('common.updated', { date: t('mentions.updated') })}
      disclaimer={disclaimer || undefined}
      sections={sections}
    />
  )
}
