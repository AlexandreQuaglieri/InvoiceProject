import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/base-url'
import { ReformSection } from '@/components/marketing/reform-section'
import { StudioSection } from '@/components/marketing/studio-section'

const TITLE = 'Suis-je concerné par la facturation électronique 2026 ?'
const DESCRIPTION =
  'Deux questions, un verdict clair : ce que la réforme de la facturation électronique ' +
  '2026-2027 change pour votre activité, et quoi faire avant le 1er septembre.'

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: '/suis-je-concerne-2026',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/suis-je-concerne-2026',
    siteName: 'Factur-IA',
    type: 'website',
    locale: 'fr_FR',
    images: ['/opengraph-image'],
  },
}

// FAQ indexable : les réponses du quiz, en clair pour les moteurs.
const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'La facturation électronique 2026 concerne-t-elle les indépendants et micro-entrepreneurs ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Oui. Depuis le 1er septembre 2026, toute entreprise française assujettie à la TVA doit pouvoir recevoir des factures électroniques, quelle que soit sa taille — micro-entrepreneurs compris. L’obligation d’émettre ses factures au format électronique s’étend aux TPE, PME et micro-entreprises au 1er septembre 2027.',
      },
    },
    {
      '@type': 'Question',
      name: 'Je ne facture que des particuliers (B2C) : suis-je concerné ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Vous devez quand même être en mesure de recevoir les factures électroniques de vos fournisseurs. Vos ventes aux particuliers ne passent pas par la facturation électronique, mais relèvent de l’e-reporting : la transmission périodique des données de transaction à l’administration via une plateforme agréée.',
      },
    },
    {
      '@type': 'Question',
      name: 'Faut-il obligatoirement passer par une plateforme agréée (PDP) ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Oui, c’est le principe du dispositif : les factures électroniques circulent entre plateformes agréées par l’administration. Factur-IA raccorde gratuitement votre compte à sa plateforme partenaire, en quelques minutes.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quelles sont les échéances de la réforme de la facturation électronique ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '1er septembre 2026 : toutes les entreprises doivent pouvoir recevoir des factures électroniques ; grandes entreprises et ETI doivent commencer à en émettre. 1er septembre 2027 : l’obligation d’émission s’étend aux PME, TPE et micro-entreprises.',
      },
    },
  ],
}

/** Page dédiée et partageable du quiz réforme (lead magnet 1er septembre). */
export default function ReformQuizPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <ReformSection />
      <StudioSection />
    </>
  )
}
