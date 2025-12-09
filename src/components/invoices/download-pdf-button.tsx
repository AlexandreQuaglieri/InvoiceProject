'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { FileText, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface DownloadPdfButtonProps {
  invoiceId: string
}

export function DownloadPdfButton({ invoiceId }: DownloadPdfButtonProps) {
  const t = useTranslations()
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors du téléchargement')
      }

      // Récupérer le nom du fichier depuis les headers
      const contentDisposition = response.headers.get('Content-Disposition')
      const fileNameMatch = contentDisposition?.match(/filename="(.+)"/)
      const fileName = fileNameMatch ? fileNameMatch[1] : `facture_${invoiceId}.pdf`

      // Télécharger le fichier
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
      console.error('Error downloading PDF:', error)
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
      {isLoading ? 'Génération...' : t('invoices.downloadPdf')}
    </Button>
  )
}
