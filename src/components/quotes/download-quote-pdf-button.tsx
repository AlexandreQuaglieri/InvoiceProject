'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DownloadQuotePdfButtonProps {
  quoteId: string
}

export function DownloadQuotePdfButton({ quoteId }: DownloadQuotePdfButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/quotes/${quoteId}/pdf`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors du téléchargement')
      }

      const contentDisposition = response.headers.get('Content-Disposition')
      const fileNameMatch = contentDisposition?.match(/filename="(.+)"/)
      const fileName = fileNameMatch ? fileNameMatch[1] : `devis_${quoteId}.pdf`

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF téléchargé')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors du téléchargement')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleDownload}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileText className="mr-2 h-4 w-4" />
      )}
      {isLoading ? 'Génération...' : 'Télécharger PDF'}
    </Button>
  )
}
