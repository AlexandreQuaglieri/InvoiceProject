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
// récupéré séparément via downloadInvoice(). Le résumé (émetteur, montant…) provient
// des données structurées EN16931 (en_invoice) quand elles sont disponibles.
export type PdpInboundInvoice = {
  depositId: string
  externalId?: string
  receivedAt: string
  number?: string
  sellerName?: string
  sellerVat?: string
  totalWithVat?: number
  currency?: string
  issueDate?: string
}

// E-reporting B2C (déclaration des ventes aux particuliers à l'administration).
export type PdpB2cTaxSubtotal = {
  tax_percent: string
  taxable_amount: string
  tax_total: string
}

export type PdpB2cTransaction = {
  category_code: 'TLB1' | 'TPS1' | 'TNT1' | 'TMA1' // catégorie AFNOR Z12-012 (TPS1 = prestation de services)
  currency: string
  date: string
  role_code: 'SE' | 'BY' // SE = vendeur, BY = acheteur
  tax_exclusive_amount: string
  tax_total: string
  tax_subtotals: PdpB2cTaxSubtotal[]
}

// Période d'e-reporting agrégée par la PDP.
export type PdpEReporting = {
  id: number
  kind: 'transaction' | 'payment'
  roleCode: 'SE' | 'BY'
  startPeriod: string
  endPeriod: string
}

// Résultat de validation de conformité d'une facture (schematrons EN16931 / FR-CTC).
export type PdpValidationResult = {
  isValid: boolean
  format?: string
  conformanceLevel?: string
  failures: Array<{ validator?: string; message: string }>
}
