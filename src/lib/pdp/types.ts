// Types provider-agnostic pour l'intégration d'une Plateforme de Dématérialisation
// Partenaire (PDP / Plateforme Agréée) — facturation électronique B2B (réforme FR 2026).

// Sens d'une facture côté plateforme.
export type PdpDirection = 'in' | 'out'

export type PdpFormat = 'facturx' | 'ubl' | 'cii'

// Statuts normalisés du cycle de vie (modèle de l'application). Les 4 premiers sont
// OBLIGATOIRES à transmettre à l'administration ; les suivants sont recommandés.
// Le mapping vers les codes bruts de la PDP (AFNOR fr:2xx / PPF) est géré côté provider.
export type PdpLifecycleStatus =
  | 'deposee'
  | 'rejetee'
  | 'refusee'
  | 'encaissee'
  | 'mise_a_disposition'
  | 'prise_en_charge'
  | 'approuvee'
  | 'approuvee_partiellement'
  | 'en_litige'
  | 'suspendue'
  | 'paiement_transmis'

// Résultat de la transmission d'une facture sortante.
export type PdpTransmissionResult = {
  depositId: string // identifiant de la facture côté PDP
  transmittedAt: string
}

// Événement de cycle de vie d'une facture. On conserve le code brut de la PDP
// (ex. "fr:204", "ppf:payment-received") — plus riche que l'enum normalisé, la
// normalisation est faite par la couche applicative (brique « statuts »).
export type PdpLifecycleEvent = {
  depositId: string
  statusCode: string
  statusText?: string
  occurredAt: string
  reason?: string
}

// Métadonnées d'une facture entrante (réception). Le contenu brut (Factur-X) est
// récupéré séparément via downloadInvoice().
export type PdpInboundInvoice = {
  depositId: string
  externalId?: string
  senderSiren?: string
  receivedAt: string
}

// Données e-reporting (B2C, international, statuts de paiement) — structure à affiner.
export type PdpEReportingPayload = Record<string, unknown>

// Résultat de validation de conformité d'une facture (schematrons EN16931 / FR-CTC).
export type PdpValidationResult = {
  isValid: boolean
  format?: string
  conformanceLevel?: string
  failures: Array<{ validator?: string; message: string }>
}
