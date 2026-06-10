// Mapping PUR des codes de statut e-invoicing (AFNOR fr:* + internes api:* de la
// PDP) vers des libellés i18n et un ton visuel. Source de vérité : OpenAPI Super
// PDP, schéma status_code (vérifié 2026-06-10) :
//   fr:200 Déposée · fr:201 Émise · fr:202 Reçue · fr:203 Mise à disposition ·
//   fr:204 Prise en charge · fr:205 Approuvée · fr:206 Approuvée partiellement ·
//   fr:207 En litige · fr:208 Suspendue · fr:209 Complétée · fr:210 Refusée ·
//   fr:211 Paiement transmis · fr:212 Encaissée · fr:213 Rejetée
// Importable côté client (badge) ET côté serveur (cron) — aucune dépendance.
import type { Invoice } from '@/types/database'

export type EinvoicingTone = 'neutral' | 'info' | 'success' | 'warning' | 'destructive'

export type EinvoicingStatusInfo = {
  labelKey: string // clé sous einvoicing.status.* (fr.json / en.json)
  tone: EinvoicingTone
  terminal: boolean
}

const STATUS_MAP: Record<string, EinvoicingStatusInfo> = {
  'api:uploaded': { labelKey: 'transmitted', tone: 'neutral', terminal: false },
  'api:validated': { labelKey: 'transmitted', tone: 'neutral', terminal: false },
  'api:sent': { labelKey: 'deposited', tone: 'neutral', terminal: false },
  'api:received': { labelKey: 'received', tone: 'neutral', terminal: false },
  'api:acknowledged': { labelKey: 'acknowledged', tone: 'info', terminal: false },
  'api:accepted': { labelKey: 'approved', tone: 'success', terminal: false },
  'api:invalid': { labelKey: 'rejected', tone: 'destructive', terminal: true },
  'api:rejected': { labelKey: 'rejected', tone: 'destructive', terminal: true },
  'fr:200': { labelKey: 'deposited', tone: 'neutral', terminal: false },
  'fr:201': { labelKey: 'sent', tone: 'neutral', terminal: false },
  'fr:202': { labelKey: 'received', tone: 'neutral', terminal: false },
  'fr:203': { labelKey: 'madeAvailable', tone: 'neutral', terminal: false },
  'fr:204': { labelKey: 'acknowledged', tone: 'info', terminal: false },
  'fr:205': { labelKey: 'approved', tone: 'success', terminal: false },
  'fr:206': { labelKey: 'partiallyApproved', tone: 'info', terminal: false },
  'fr:207': { labelKey: 'disputed', tone: 'warning', terminal: false },
  'fr:208': { labelKey: 'suspended', tone: 'warning', terminal: false },
  'fr:209': { labelKey: 'completed', tone: 'success', terminal: true },
  'fr:210': { labelKey: 'refused', tone: 'destructive', terminal: true },
  'fr:211': { labelKey: 'paymentSent', tone: 'success', terminal: false },
  'fr:212': { labelKey: 'collected', tone: 'success', terminal: true },
  'fr:213': { labelKey: 'rejected', tone: 'destructive', terminal: true },
  'fr:501': { labelKey: 'rejected', tone: 'destructive', terminal: true },
}

// Codes AFNOR poussables par l'application (enum status_code_create de l'OpenAPI).
export const PUSHABLE_CODES = {
  acknowledged: 'fr:204',
  approved: 'fr:205',
  partiallyApproved: 'fr:206',
  disputed: 'fr:207',
  suspended: 'fr:208',
  completed: 'fr:209',
  refused: 'fr:210',
  paymentSent: 'fr:211',
  paymentReceived: 'fr:212',
} as const

// Codes terminaux : plus rien à synchroniser ensuite (cron).
export const TERMINAL_PDP_CODES: ReadonlySet<string> = new Set(
  Object.entries(STATUS_MAP)
    .filter(([, info]) => info.terminal)
    .map(([code]) => code)
)

export function statusInfo(code: string): EinvoicingStatusInfo | null {
  return STATUS_MAP[code] ?? null
}

export type EinvoicingState =
  | { kind: 'none' }
  | { kind: 'transmitted' } // dépôt sans statut connu
  | { kind: 'status'; code: string; info: EinvoicingStatusInfo | null; statusText: string | null }

// État e-invoicing dérivé d'une facture (fonction pure — charte règle 1).
export function einvoicingState(
  invoice: Pick<Invoice, 'pdp_deposit_id' | 'pdp_status' | 'pdp_status_text'>
): EinvoicingState {
  if (!invoice.pdp_deposit_id) return { kind: 'none' }
  if (!invoice.pdp_status) return { kind: 'transmitted' }
  return {
    kind: 'status',
    code: invoice.pdp_status,
    info: statusInfo(invoice.pdp_status),
    statusText: invoice.pdp_status_text ?? null,
  }
}
