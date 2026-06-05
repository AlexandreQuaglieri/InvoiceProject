import type {
  PdpTransmissionResult,
  PdpLifecycleEvent,
  PdpInboundInvoice,
  PdpB2cTransaction,
  PdpEReporting,
  PdpValidationResult,
} from './types'

// Interface provider-agnostic d'une PDP. Une implémentation concrète par plateforme
// agréée (Super PDP, etc.). Le reste de l'application ne dépend que de cette interface,
// ce qui permet de brancher ou de changer de PDP sans rien toucher d'autre — exactement
// comme le client Chorus Pro encapsule la transmission B2G.
export interface PdpProvider {
  readonly name: string

  // Émission : transmettre une facture sortante (Factur-X) à la PDP. Le destinataire
  // est routé d'après les données embarquées dans le Factur-X.
  transmitInvoice(input: { facturX: Buffer; invoiceNumber: string }): Promise<PdpTransmissionResult>

  // Validation de conformité (schematrons EN16931 / FR-CTC), SANS transmission.
  validateInvoice(input: { facturX: Buffer; fileName?: string }): Promise<PdpValidationResult>

  // Télécharge le fichier brut (Factur-X) d'une facture (sortante ou entrante).
  downloadInvoice(depositId: string): Promise<Buffer>

  // Cycle de vie : récupérer l'historique des événements/statuts d'une facture.
  getLifecycle(depositId: string): Promise<PdpLifecycleEvent[]>

  // Cycle de vie : pousser un statut (code PDP/AFNOR, ex. "fr:204" approuvée, "fr:208" refusée).
  pushStatus(depositId: string, statusCode: string, reason?: string): Promise<void>

  // Réception : lister les factures entrantes (métadonnées ; contenu via downloadInvoice).
  listInbound(): Promise<PdpInboundInvoice[]>

  // E-reporting : déclarer une transaction B2C (vente à un particulier).
  reportB2cTransaction(tx: PdpB2cTransaction): Promise<{ id: number }>

  // E-reporting : lister les périodes d'e-reporting.
  listEReportings(): Promise<PdpEReporting[]>
}
