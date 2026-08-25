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
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'Factur-IA',
    type: 'website',
    locale: 'fr_FR',
    images: ['/opengraph-image'],
  },
}

// Données structurées : l'application et son éditeur.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'Factur-IA',
      url: getBaseUrl(),
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: 'fr',
      description: DESCRIPTION,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
      },
      featureList: [
        'Factures et devis conformes Factur-X',
        'Facturation électronique 2026 (transmission via plateforme agréée)',
        'Réception des factures fournisseurs',
        'E-reporting B2C',
        'Assistant IA et pilotage depuis Claude ou ChatGPT (MCP)',
      ],
      softwareHelp: 'https://www.quatools.fr/outils/facturation/docs',
    },
    {
      '@type': 'Organization',
      name: 'Quatools',
      url: 'https://www.quatools.fr',
      sameAs: ['https://github.com/AlexandreQuaglieri/InvoiceProject'],
    },
  ],
}

/** Landing publique. */
export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <HeroSection />
      <SectionDivider />
      <MethodsSection />
      <McpSection />
      <DoDontSection />
      <SectionDivider pigeon />
      <ReformSection showPageLink />
      <StudioSection />
    </>
  )
}
