// Types du store live (charte règle 2 : Realtime + optimistic, zéro actualisation).
// Le store est seedé en RSC par le layout (dashboard) puis maintenu vivant par
// Supabase Realtime ; les hooks (useLiveInvoices, …) sont la SEULE façon pour les
// composants de lire ces données côté client.
import type {
  Company,
  Client,
  InboundInvoice,
  InvoiceWithRelations,
  QuoteWithRelations,
} from '@/types/database'
import type { Conversation } from '@/actions/conversations'

export type LiveStore = {
  company: Company | null
  clients: Client[]
  invoices: InvoiceWithRelations[]
  quotes: QuoteWithRelations[]
  conversations: Conversation[]
  inboundInvoices: InboundInvoice[]
}

// Collections indexées par id (toutes les lignes en portent un).
export type LiveCollection = Exclude<keyof LiveStore, 'company'>

export type LiveStoreAction =
  | { type: 'SET_COMPANY'; company: Company | null }
  | { type: 'UPSERT_CLIENT'; row: Client }
  | { type: 'REMOVE_CLIENT'; id: string }
  | { type: 'UPSERT_INVOICE'; row: InvoiceWithRelations }
  | { type: 'REMOVE_INVOICE'; id: string }
  | { type: 'UPSERT_QUOTE'; row: QuoteWithRelations }
  | { type: 'REMOVE_QUOTE'; id: string }
  | { type: 'UPSERT_CONVERSATION'; row: Conversation }
  | { type: 'REMOVE_CONVERSATION'; id: string }
  | { type: 'UPSERT_INBOUND'; row: InboundInvoice }
  | { type: 'REMOVE_INBOUND'; id: string }
  | { type: 'REPLACE_ALL'; state: LiveStore }

// Actions exposées aux composants pour l'optimistic UI (write-through après
// résolution d'une server action, ou rollback en cas d'erreur).
export type LiveStoreActions = {
  setCompany: (company: Company | null) => void
  upsertClient: (row: Client) => void
  removeClient: (id: string) => void
  upsertInvoice: (row: InvoiceWithRelations) => void
  removeInvoice: (id: string) => void
  upsertQuote: (row: QuoteWithRelations) => void
  removeQuote: (id: string) => void
  upsertConversation: (row: Conversation) => void
  removeConversation: (id: string) => void
  upsertInbound: (row: InboundInvoice) => void
  removeInbound: (id: string) => void
}
