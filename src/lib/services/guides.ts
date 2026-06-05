// Fiches de référence (métier français + produit) pour l'assistant IA.
// Contenu statique et curaté : l'assistant s'appuie dessus plutôt que d'inventer
// des règles ou des dates. Les points juridiquement mouvants sont explicitement
// marqués « à vérifier » pour éviter d'asséner des chiffres périmés.

export const GUIDE_TOPICS = [
  'mentions_obligatoires',
  'tva',
  'delais_paiement',
  'facturation_electronique_2026',
  'chorus_pro',
  'app_demarrage',
  'app_fonctionnalites',
] as const

export type GuideTopic = (typeof GUIDE_TOPICS)[number]

const GUIDES: Record<GuideTopic, string> = {
  mentions_obligatoires: `Mentions obligatoires sur une facture (France) :
- Numéro de facture unique et séquentiel ; date d'émission.
- Vendeur : dénomination/nom, adresse, SIREN/SIRET, forme juridique et capital social (sociétés), RCS + ville du greffe (commerçants) ou n° au Répertoire des Métiers (artisans), n° de TVA intracommunautaire si redevable.
- Client : nom/dénomination et adresse (adresse de livraison si différente).
- Date de la vente ou de la prestation si différente de la date d'émission.
- Pour chaque ligne : désignation, quantité, prix unitaire HT, taux de TVA ; remises éventuelles.
- Totaux : total HT par taux de TVA, montant de la TVA, total TTC.
- Conditions et date d'échéance de paiement ; taux des pénalités de retard ; indemnité forfaitaire de recouvrement de 40 € ; conditions d'escompte.
- Si franchise en base de TVA : mention « TVA non applicable, art. 293 B du CGI ».
- Selon l'activité : assurance professionnelle obligatoire (ex. BTP), n° de bon de commande.`,

  tva: `TVA en France :
- Taux normal 20 % ; intermédiaire 10 % ; réduit 5,5 % ; particulier 2,1 %.
- Franchise en base de TVA : l'entreprise ne facture pas de TVA (taux 0 %) et porte la mention « TVA non applicable, art. 293 B du CGI ». Elle ne récupère pas la TVA sur ses achats.
- Seuils de franchise : À VÉRIFIER avec la dernière loi de finances (ils ont évolué et un seuil unique a été envisagé puis suspendu). Ordres de grandeur récents : ventes de marchandises ~85 000 € / prestations de services ~37 500 € (seuils majorés au-delà). Inviter l'utilisateur à confirmer sa situation à jour auprès de l'administration.
- Au-delà des seuils ou sur option : régime réel (TVA facturée et déductible).`,

  delais_paiement: `Délais de paiement (B2B, France) :
- À défaut d'accord : paiement à 30 jours après réception des biens / de la prestation.
- Maximum négociable : 60 jours à compter de la date de facture, ou 45 jours fin de mois.
- Pénalités de retard obligatoires sur la facture : taux au moins égal à 3 fois le taux d'intérêt légal (à défaut, taux directeur BCE + 10 points).
- Indemnité forfaitaire de 40 € pour frais de recouvrement, due dès le premier jour de retard.`,

  facturation_electronique_2026: `Facturation électronique obligatoire (réforme française) — TOUJOURS vérifier le calendrier officiel, il a déjà été décalé :
- RÉCEPTION : toutes les entreprises assujetties à la TVA doivent pouvoir RECEVOIR des factures électroniques à compter du 1er septembre 2026.
- ÉMISSION : 1er septembre 2026 pour les grandes entreprises et ETI ; 1er septembre 2027 pour les PME et microentreprises.
- Les factures B2B domestiques transitent par une PDP (Plateforme de Dématérialisation Partenaire immatriculée) ; le Portail Public de Facturation (PPF) joue un rôle d'annuaire / concentrateur.
- Formats au socle EN 16931 : Factur-X (PDF/A-3 avec XML CII embarqué), UBL, CII.
- S'ajoute l'e-reporting des données de transactions (ventes B2C et opérations internationales) selon le même calendrier.
- Bon à savoir : Factur-IA génère déjà des factures au format Factur-X conforme — un atout pour être prêt.`,

  chorus_pro: `Chorus Pro (factures vers le secteur public, B2G) :
- Obligatoire pour facturer l'État, les collectivités et les établissements publics.
- Dans Factur-IA : configurer l'accès dans les Paramètres, puis transmettre une facture FINALISÉE (pas un brouillon) depuis sa page ; l'application envoie le flux Factur-X via la plateforme PISTE.
- C'est distinct de la réforme B2B 2026 (qui, elle, passe par les PDP).`,

  app_demarrage: `Prise en main de Factur-IA :
1. Renseigner la fiche entreprise (menu « Entreprise ») : raison sociale, SIRET, adresse, TVA, logo, coordonnées bancaires.
2. Ajouter des clients (saisie manuelle, recherche par SIRET, ou via l'assistant).
3. Créer un devis ou une facture, puis générer le PDF.
4. Suivre l'activité depuis le tableau de bord (CA, impayés, relances).
Astuce : tout peut être piloté en langage naturel via l'assistant.`,

  app_fonctionnalites: `Fonctionnalités de Factur-IA :
- Création de factures / devis avec PDF, multi-taux de TVA, remises, conversion devis → facture.
- Extraction IA de documents (Kbis, RIB) pour pré-remplir la fiche entreprise.
- Recherche d'entreprise par SIRET (API officielle) pour créer un client professionnel.
- Factur-X (facture électronique) et transmission Chorus Pro (secteur public).
- Assistant IA (celui-ci) pour agir et répondre en langage naturel.
- Connexion à Claude.ai via un serveur MCP (jetons dans les Paramètres).
- Clé Claude personnelle (BYOK) configurable dans les Paramètres.
- Synchronisation Data Wallet.`,
}

// Renvoie la fiche correspondant au sujet, ou null si le sujet est inconnu.
export function getGuide(topic: string): string | null {
  return (GUIDES as Record<string, string>)[topic] ?? null
}
