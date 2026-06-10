'use client'

// Provider du store live (charte règle 2). Seul endroit côté client qui parle à
// Supabase : paint initial seedé par le layout RSC, puis un channel Realtime
// unique (live:{companyId}) garde la donnée vivante. Les mutations utilisateur
// font du write-through optimiste via useLiveStoreActions() ; les écritures
// externes (chat IA, MCP, autre onglet) arrivent par Realtime.
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Client, Company, InboundInvoice, InvoiceWithRelations, QuoteWithRelations } from '@/types/database'
import type { Conversation } from '@/actions/conversations'
import type { LiveStore, LiveStoreAction, LiveStoreActions } from './types'
import { fetchFullStore, fetchInvoiceWithRelations, fetchQuoteWithRelations } from './refetch'

export const LiveStoreContext = createContext<LiveStore | null>(null)
export const LiveStoreActionsContext = createContext<LiveStoreActions | null>(null)

// Ignore les events Realtime plus vieux que l'état local (l'optimistic
// write-through est toujours plus frais qu'un event retardataire).
function isStale(existing: { updated_at?: string | null }, incoming: { updated_at?: string | null }): boolean {
  if (!existing.updated_at || !incoming.updated_at) return false
  return new Date(incoming.updated_at).getTime() < new Date(existing.updated_at).getTime()
}

function upsertById<T extends { id: string; updated_at?: string | null }>(rows: T[], row: T): T[] {
  const index = rows.findIndex((r) => r.id === row.id)
  if (index === -1) return [row, ...rows]
  if (isStale(rows[index], row)) return rows
  const next = [...rows]
  // Merge : un event Realtime ne porte que les colonnes scalaires — on conserve
  // les relations (client, items) déjà présentes dans le store.
  next[index] = { ...rows[index], ...row }
  return next
}

function removeById<T extends { id: string }>(rows: T[], id: string): T[] {
  return rows.filter((r) => r.id !== id)
}

function reducer(state: LiveStore, action: LiveStoreAction): LiveStore {
  switch (action.type) {
    case 'SET_COMPANY':
      return { ...state, company: action.company }
    case 'UPSERT_CLIENT':
      return { ...state, clients: upsertById(state.clients, action.row) }
    case 'REMOVE_CLIENT':
      return { ...state, clients: removeById(state.clients, action.id) }
    case 'UPSERT_INVOICE':
      return { ...state, invoices: upsertById(state.invoices, action.row) }
    case 'REMOVE_INVOICE':
      return { ...state, invoices: removeById(state.invoices, action.id) }
    case 'UPSERT_QUOTE':
      return { ...state, quotes: upsertById(state.quotes, action.row) }
    case 'REMOVE_QUOTE':
      return { ...state, quotes: removeById(state.quotes, action.id) }
    case 'UPSERT_CONVERSATION':
      return { ...state, conversations: upsertById(state.conversations, action.row) }
    case 'REMOVE_CONVERSATION':
      return { ...state, conversations: removeById(state.conversations, action.id) }
    case 'UPSERT_INBOUND':
      return { ...state, inboundInvoices: upsertById(state.inboundInvoices, action.row) }
    case 'REMOVE_INBOUND':
      return { ...state, inboundInvoices: removeById(state.inboundInvoices, action.id) }
    case 'REPLACE_ALL':
      return action.state
    default:
      return state
  }
}

type LiveStoreProviderProps = {
  userId: string
  companyId: string | null
  initial: LiveStore
  children: ReactNode
}

export function LiveStoreProvider({ userId, companyId, initial, children }: LiveStoreProviderProps) {
  const [store, dispatch] = useReducer(reducer, initial)

  // Le client browser est stable pour toute la vie du provider.
  const supabaseRef = useRef<SupabaseClient | null>(null)
  if (supabaseRef.current == null) {
    supabaseRef.current = createClient()
  }

  // Accès à l'état courant depuis les handlers d'events (sans re-subscribe).
  const storeRef = useRef(store)
  useEffect(() => {
    storeRef.current = store
  }, [store])

  // Debounce des refetchs parents quand des lignes (invoice_items / quote_items) bougent :
  // une facture de 30 lignes créée par l'IA génère ~30 events mais 1 seul refetch.
  const pendingRefetch = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const scheduleParentRefetch = useCallback(
    (kind: 'invoice' | 'quote', parentId: string) => {
      const supabase = supabaseRef.current
      if (!supabase) return
      const key = `${kind}:${parentId}`
      const existing = pendingRefetch.current.get(key)
      if (existing) clearTimeout(existing)
      pendingRefetch.current.set(
        key,
        setTimeout(async () => {
          pendingRefetch.current.delete(key)
          if (kind === 'invoice') {
            const row = await fetchInvoiceWithRelations(supabase, parentId)
            if (row) dispatch({ type: 'UPSERT_INVOICE', row })
          } else {
            const row = await fetchQuoteWithRelations(supabase, parentId)
            if (row) dispatch({ type: 'UPSERT_QUOTE', row })
          }
        }, 150)
      )
    },
    []
  )

  useEffect(() => {
    const supabase = supabaseRef.current
    if (!supabase || !companyId) return

    let channel: RealtimeChannel | null = null
    let disposed = false
    let hadDisconnect = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const resync = async () => {
      const fresh = await fetchFullStore(supabase, companyId, userId)
      if (fresh && !disposed) dispatch({ type: 'REPLACE_ALL', state: fresh })
    }

    type RealtimeRow = Record<string, unknown>

    const handleScalarChange = (
      table: 'clients' | 'invoices' | 'quotes' | 'conversations',
      eventType: string,
      newRow: RealtimeRow,
      oldRow: RealtimeRow
    ) => {
      // Filet : ignore tout event d'une autre entreprise (les events DELETE ne
      // sont pas filtrés par les policies RLS).
      const scope = table === 'conversations' ? 'user_id' : 'company_id'
      const scopeValue = table === 'conversations' ? userId : companyId
      const row = eventType === 'DELETE' ? oldRow : newRow
      if (row[scope] !== undefined && row[scope] !== scopeValue) return

      const id = row.id as string
      if (!id) return

      if (eventType === 'DELETE') {
        if (table === 'clients') dispatch({ type: 'REMOVE_CLIENT', id })
        else if (table === 'invoices') dispatch({ type: 'REMOVE_INVOICE', id })
        else if (table === 'quotes') dispatch({ type: 'REMOVE_QUOTE', id })
        else dispatch({ type: 'REMOVE_CONVERSATION', id })
        return
      }

      if (table === 'clients') {
        dispatch({ type: 'UPSERT_CLIENT', row: newRow as unknown as Client })
        return
      }
      if (table === 'conversations') {
        dispatch({ type: 'UPSERT_CONVERSATION', row: newRow as unknown as Conversation })
        return
      }

      // Factures / devis : l'event ne porte pas les relations. Ligne connue → merge
      // scalaire (le reducer conserve client/items) ; INSERT inconnu (ou client_id
      // changé) → refetch complet pour ne jamais exposer une ligne sans relations.
      if (table === 'invoices') {
        const known = storeRef.current.invoices.find((i) => i.id === id)
        if (known && known.client_id === newRow.client_id) {
          dispatch({ type: 'UPSERT_INVOICE', row: newRow as unknown as InvoiceWithRelations })
        } else {
          scheduleParentRefetch('invoice', id)
        }
      } else {
        const known = storeRef.current.quotes.find((q) => q.id === id)
        if (known && known.client_id === newRow.client_id) {
          dispatch({ type: 'UPSERT_QUOTE', row: newRow as unknown as QuoteWithRelations })
        } else {
          scheduleParentRefetch('quote', id)
        }
      }
    }

    const subscribe = () => {
      channel = supabase
        .channel(`live:${companyId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'companies', filter: `id=eq.${companyId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') dispatch({ type: 'SET_COMPANY', company: null })
            else dispatch({ type: 'SET_COMPANY', company: payload.new as unknown as Company })
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'clients', filter: `company_id=eq.${companyId}` },
          (payload) =>
            handleScalarChange('clients', payload.eventType, payload.new as RealtimeRow, payload.old as RealtimeRow)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'invoices', filter: `company_id=eq.${companyId}` },
          (payload) =>
            handleScalarChange('invoices', payload.eventType, payload.new as RealtimeRow, payload.old as RealtimeRow)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quotes', filter: `company_id=eq.${companyId}` },
          (payload) =>
            handleScalarChange('quotes', payload.eventType, payload.new as RealtimeRow, payload.old as RealtimeRow)
        )
        .on(
          'postgres_changes',
          // Pas de company_id sur les lignes : non filtré (la RLS borne ce qui est
          // reçu) → refetch debounced du parent si on le connaît.
          { event: '*', schema: 'public', table: 'invoice_items' },
          (payload) => {
            const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as RealtimeRow
            const parentId = row.invoice_id as string | undefined
            if (parentId && storeRef.current.invoices.some((i) => i.id === parentId)) {
              scheduleParentRefetch('invoice', parentId)
            } else if (parentId && payload.eventType === 'INSERT') {
              // Lignes d'une facture pas encore dans le store (création externe) :
              // le refetch upsertera la facture complète.
              scheduleParentRefetch('invoice', parentId)
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quote_items' },
          (payload) => {
            const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as RealtimeRow
            const parentId = row.quote_id as string | undefined
            if (parentId) scheduleParentRefetch('quote', parentId)
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${userId}` },
          (payload) =>
            handleScalarChange('conversations', payload.eventType, payload.new as RealtimeRow, payload.old as RealtimeRow)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'inbound_invoices', filter: `company_id=eq.${companyId}` },
          (payload) => {
            const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as RealtimeRow
            if (row.company_id !== undefined && row.company_id !== companyId) return
            const id = row.id as string
            if (!id) return
            if (payload.eventType === 'DELETE') dispatch({ type: 'REMOVE_INBOUND', id })
            else dispatch({ type: 'UPSERT_INBOUND', row: payload.new as unknown as InboundInvoice })
          }
        )
        .subscribe((status) => {
          if (disposed) return
          if (status === 'SUBSCRIBED') {
            // Après une coupure, des events ont pu être manqués : resync complet.
            if (hadDisconnect) {
              hadDisconnect = false
              void resync()
            }
            return
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            hadDisconnect = true
            if (retryTimer) clearTimeout(retryTimer)
            retryTimer = setTimeout(() => {
              if (disposed) return
              if (channel) supabase.removeChannel(channel)
              subscribe()
            }, 5000)
          }
        })
    }

    // Le channel Realtime authentifie avec le JWT : on le fournit au démarrage
    // et à chaque refresh, sinon le flux s'arrête silencieusement après ~1 h.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token)
    })
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        supabase.realtime.setAuth(session.access_token)
      }
    })

    subscribe()

    const pending = pendingRefetch.current
    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      authListener.subscription.unsubscribe()
      if (channel) supabase.removeChannel(channel)
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [companyId, userId, scheduleParentRefetch])

  const actions = useMemo<LiveStoreActions>(
    () => ({
      setCompany: (company) => dispatch({ type: 'SET_COMPANY', company }),
      upsertClient: (row) => dispatch({ type: 'UPSERT_CLIENT', row }),
      removeClient: (id) => dispatch({ type: 'REMOVE_CLIENT', id }),
      upsertInvoice: (row) => dispatch({ type: 'UPSERT_INVOICE', row }),
      removeInvoice: (id) => dispatch({ type: 'REMOVE_INVOICE', id }),
      upsertQuote: (row) => dispatch({ type: 'UPSERT_QUOTE', row }),
      removeQuote: (id) => dispatch({ type: 'REMOVE_QUOTE', id }),
      upsertConversation: (row) => dispatch({ type: 'UPSERT_CONVERSATION', row }),
      removeConversation: (id) => dispatch({ type: 'REMOVE_CONVERSATION', id }),
      upsertInbound: (row) => dispatch({ type: 'UPSERT_INBOUND', row }),
      removeInbound: (id) => dispatch({ type: 'REMOVE_INBOUND', id }),
    }),
    []
  )

  return (
    <LiveStoreContext.Provider value={store}>
      <LiveStoreActionsContext.Provider value={actions}>{children}</LiveStoreActionsContext.Provider>
    </LiveStoreContext.Provider>
  )
}
