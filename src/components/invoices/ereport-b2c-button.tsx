'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { BarChart3, Loader2 } from 'lucide-react'

export function EreportB2cButton({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/ereport`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la déclaration')
        return
      }
      toast.success('Vente déclarée en e-reporting (B2C)')
    } catch {
      toast.error('Impossible de contacter la PDP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" className="w-full" onClick={handle} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <BarChart3 className="mr-2 h-4 w-4" />
      )}
      Déclarer en e-reporting (B2C)
    </Button>
  )
}
