import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/base-url'
import { HeroSection } from '@/components/marketing/hero-section'
import { SectionDivider } from '@/components/marketing/section-divider'
import { MethodsSection } from '@/components/marketing/methods-section'
import { McpSection } from '@/components/marketing/mcp-section'
import { DoDontSection } from '@/components/marketing/do-dont-section'
import { ReformSection } from '@/components/marketing/reform-section'
import { StudioSection } from '@/components/marketing/studio-section'

const TITLE = "Factur-IA — La facturation qui s'écrit toute seule"
const DESCRIPTION =
  'Décrivez votre prestation en une phrase : Factur-IA rédige la facture conforme, ' +
  'la transmet via la plateforme agréée et relance vos impayés. ' +
  'Conforme facturation électronique 2026 · gratuit · sans jargon.'

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'Factur-IA',
    type: 'website',
    locale: 'fr_FR',
  },
}

/** Landing publique — visible uniquement par les anonymes (cf. middleware). */
export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <SectionDivider />
      <MethodsSection />
      <McpSection />
      <DoDontSection />
      <SectionDivider pigeon />
      <ReformSection />
      <StudioSection />
    </>
  )
}
