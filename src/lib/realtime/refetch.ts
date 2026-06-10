// Refetchs ciblés côté navigateur (client anon + RLS) pour le store live.
// Utilisés quand un event Realtime ne porte pas les relations (client, items) :
// INSERT inconnu, changement de lignes, resync après reconnexion.
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Client,
  Company,
  InboundInvoice,
  InvoiceWithRelations,
  QuoteWithRelations,
} from '@/types/database'
import type { Conversation } from '@/actions/conversations'
import type { LiveStore } from './types'

const INVOICE_SELECT = '*, client:clients(*), items:invoice_items(*)'
const QUOTE_SELECT = '*, client:clients(*), items:quote_items(*)'

export async function fetchInvoiceWithRelations(
  supabase: SupabaseClient,
  id: string
): Promise<InvoiceWithRelations | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[realtime] refetch facture en échec', { id }, error)
    return null
  }
  return data as InvoiceWithRelations | null
}

export async function fetchQuoteWithRelations(
  supabase: SupabaseClient,
  id: string
): Promise<QuoteWithRelations | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select(QUOTE_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[realtime] refetch devis en échec', { id }, error)
    return null
  }
  return data as QuoteWithRelations | null
}

// Resynchronisation complète (après reconnexion du channel : des events ont pu
// être manqués, on repart de l'état DB — la RLS borne aux données de l'utilisateur).
export async function fetchFullStore(
  supabase: SupabaseClient,
  companyId: string,
  userId: string
): Promise<LiveStore | null> {
  const [companyRes, clientsRes, invoicesRes, quotesRes, conversationsRes, inboundRes] = await Promise.all([
    supabase.from('companies').select('*').eq('id', companyId).maybeSingle(),
    supabase.from('clients').select('*').eq('company_id', companyId).order('name', { ascending: true }),
    supabase.from('invoices').select(INVOICE_SELECT).eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('quotes').select(QUOTE_SELECT).eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('conversations').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(50),
    supabase.from('inbound_invoices').select('*').eq('company_id', companyId).order('received_at', { ascending: false }),
  ])

  const failed = [companyRes.error, clientsRes.error, invoicesRes.error, quotesRes.error, conversationsRes.error, inboundRes.error].find(Boolean)
  if (failed) {
    console.error('[realtime] resync complet en échec', failed)
    return null
  }

  return {
    company: (companyRes.data as Company | null) ?? null,
    clients: (clientsRes.data ?? []) as Client[],
    invoices: (invoicesRes.data ?? []) as InvoiceWithRelations[],
    quotes: (quotesRes.data ?? []) as QuoteWithRelations[],
    conversations: (conversationsRes.data ?? []) as Conversation[],
    inboundInvoices: (inboundRes.data ?? []) as InboundInvoice[],
  }
}
