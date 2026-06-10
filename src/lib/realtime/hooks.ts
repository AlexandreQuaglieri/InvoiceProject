'use client'

// Hooks de lecture du store live. Les composants UI ne touchent JAMAIS Supabase
// directement : ils lisent ces hooks (et mutent via les server actions +
// useLiveStoreActions pour l'optimistic).
import { useContext, useMemo } from 'react'
import type { Client, Company, InboundInvoice, InvoiceWithRelations, QuoteWithRelations } from '@/types/database'
import type { Conversation } from '@/actions/conversations'
import type { LiveStoreActions } from './types'
import { LiveStoreContext, LiveStoreActionsContext } from './provider'

function useLiveStore() {
  const store = useContext(LiveStoreContext)
  if (!store) {
    throw new Error('useLiveStore doit être utilisé sous <LiveStoreProvider> (layout dashboard).')
  }
  return store
}

export function useLiveStoreActions(): LiveStoreActions {
  const actions = useContext(LiveStoreActionsContext)
  if (!actions) {
    throw new Error('useLiveStoreActions doit être utilisé sous <LiveStoreProvider>.')
  }
  return actions
}

export function useLiveCompany(): Company | null {
  return useLiveStore().company
}

export function useLiveClients(): Client[] {
  const { clients } = useLiveStore()
  return useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name)), [clients])
}

export function useLiveInvoices(): InvoiceWithRelations[] {
  const { invoices } = useLiveStore()
  return useMemo(
    () => [...invoices].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [invoices]
  )
}

export function useLiveInvoice(id: string): InvoiceWithRelations | null {
  const { invoices } = useLiveStore()
  return useMemo(() => invoices.find((i) => i.id === id) ?? null, [invoices, id])
}

export function useLiveQuotes(): QuoteWithRelations[] {
  const { quotes } = useLiveStore()
  return useMemo(
    () => [...quotes].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [quotes]
  )
}

export function useLiveQuote(id: string): QuoteWithRelations | null {
  const { quotes } = useLiveStore()
  return useMemo(() => quotes.find((q) => q.id === id) ?? null, [quotes, id])
}

export function useLiveInboundInvoices(): InboundInvoice[] {
  const { inboundInvoices } = useLiveStore()
  return useMemo(
    () => [...inboundInvoices].sort((a, b) => b.received_at.localeCompare(a.received_at)),
    [inboundInvoices]
  )
}

export function useLiveConversations(): Conversation[] {
  const { conversations } = useLiveStore()
  return useMemo(
    () => [...conversations].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [conversations]
  )
}
