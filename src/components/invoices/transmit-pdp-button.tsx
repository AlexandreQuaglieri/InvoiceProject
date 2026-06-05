'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ShieldCheck, Send, Loader2 } from 'lucide-react'

interface TransmitPdpButtonProps {
  invoiceId: string
  canTransmit: boolean
}

export function TransmitPdpButton({ invoiceId, canTransmit }: TransmitPdpButtonProps) {
  const [validating, setValidating] = useState(false)
  const [transmitting, setTransmitting] = useState(false)

  const handleValidate = async () => {
    setValidating(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/validate-pdp`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la vérification')
        return
      }
      if (data.isValid) {
        toast.success(
          `Facture conforme ✅${data.conformanceLevel ? ` (${data.conformanceLevel})` : ''}`
        )
      } else {
        toast.error(`Non conforme : ${data.failures?.length || 0} erreur(s)`, {
          description: (data.failures || [])
            .slice(0, 3)
            .map((f: { message: string }) => f.message)
            .join('\n'),
        })
      }
    } catch {
      toast.error('Impossible de contacter la PDP')
    } finally {
      setValidating(false)
    }
  }

  const handleTransmit = async () => {
    setTransmitting(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/transmit-pdp`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la transmission')
        return
      }
      toast.success(`Facture transmise via PDP\nDépôt n° ${data.depositId}`)
    } catch {
      toast.error('Impossible de contacter la PDP')
    } finally {
      setTransmitting(false)
    }
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={handleValidate} disabled={validating}>
        {validating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="mr-2 h-4 w-4" />
        )}
        Vérifier la conformité (e-invoicing)
      </Button>
      {canTransmit && (
        <Button variant="outline" className="w-full" onClick={handleTransmit} disabled={transmitting}>
          {transmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Transmettre (PDP — facturation électronique)
        </Button>
      )}
    </>
  )
}
