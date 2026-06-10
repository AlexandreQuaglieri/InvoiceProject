'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Send, Loader2 } from 'lucide-react'

interface TransmitChorusProButtonProps {
  invoiceId: string
}

export function TransmitChorusProButton({ invoiceId }: TransmitChorusProButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleTransmit = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/transmit`, {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erreur lors de la transmission')
        return
      }

      toast.success(
        `Facture transmise à Chorus Pro\nN° flux : ${data.numeroFluxDepot}`
      )
    } catch (error) {
      console.error('Transmission à Chorus Pro échouée', error)
      toast.error('Impossible de contacter Chorus Pro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleTransmit}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Send className="mr-2 h-4 w-4" />
      )}
      Transmettre à un client public (Chorus Pro)
    </Button>
  )
}
