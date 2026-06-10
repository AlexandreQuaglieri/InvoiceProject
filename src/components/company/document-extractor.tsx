'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { FileText, Loader2, Sparkles, CheckCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import type { CompanyFormData } from '@/lib/validations/company'

type ExtractedCompanyData = Partial<CompanyFormData>

interface DocumentExtractorProps {
  onDataExtracted: (data: ExtractedCompanyData) => void
}

export function DocumentExtractor({ onDataExtracted }: DocumentExtractorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedCompanyData | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fonction pour compresser une image si nécessaire
  const compressImage = async (file: File, maxSizeMB: number = 4.5): Promise<File> => {
    // Si c'est un PDF ou si la taille est OK, retourner tel quel
    if (file.type === 'application/pdf' || file.size <= maxSizeMB * 1024 * 1024) {
      return file
    }

    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      img.onload = () => {
        // Calculer le ratio de compression nécessaire
        const quality = 0.8
        let scale = 1

        // Si l'image est très grande, réduire la résolution
        const maxDimension = 2000
        if (img.width > maxDimension || img.height > maxDimension) {
          scale = maxDimension / Math.max(img.width, img.height)
        }

        canvas.width = img.width * scale
        canvas.height = img.height * scale

        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Essayer différentes qualités jusqu'à atteindre la taille cible
        const tryCompress = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Compression failed'))
                return
              }

              if (blob.size <= maxSizeMB * 1024 * 1024 || q <= 0.3) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                })
                resolve(compressedFile)
              } else {
                tryCompress(q - 0.1)
              }
            },
            'image/jpeg',
            q
          )
        }

        tryCompress(quality)
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Vérifier le type de fichier
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez PNG, JPG, WebP ou PDF.')
      return
    }

    // Vérifier la taille (max 20MB avant compression)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux (max 20MB)')
      return
    }

    setFileName(file.name)
    setIsLoading(true)

    try {
      // Compresser l'image si nécessaire
      const processedFile = await compressImage(file)

      const formData = new FormData()
      formData.append('file', processedFile)
      formData.append('type', 'kbis')

      const response = await fetch('/api/extract-document', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success && result.data) {
        setExtractedData(result.data)
        setShowConfirmDialog(true)
        toast.success('Document analysé avec succès !')
      } else {
        toast.error(result.error || 'Erreur lors de l\'analyse du document')
      }
    } catch (error) {
      console.error('Error extracting document:', error)
      toast.error('Erreur lors de l\'analyse du document')
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleConfirm = () => {
    if (extractedData) {
      onDataExtracted(extractedData)
      toast.success('Données appliquées au formulaire')
    }
    setShowConfirmDialog(false)
    setExtractedData(null)
  }

  const handleCancel = () => {
    setShowConfirmDialog(false)
    setExtractedData(null)
  }

  const legalFormLabels: Record<string, string> = {
    auto_entrepreneur: 'Auto-entrepreneur',
    ei: 'Entreprise Individuelle',
    eurl: 'EURL',
    sarl: 'SARL',
    sasu: 'SASU',
    sas: 'SAS',
    sa: 'SA',
    association: 'Association',
    profession_liberale: 'Profession libérale',
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Extraction automatique
          </CardTitle>
          <CardDescription>
            Chargez votre Kbis ou un document officiel pour remplir automatiquement le formulaire.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleClick}
            disabled={isLoading}
            className="w-full h-auto py-4 flex-col gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Analyse en cours...</span>
                <span className="text-xs text-muted-foreground">
                  L&apos;IA extrait les informations
                </span>
              </>
            ) : (
              <>
                <FileText className="h-6 w-6" />
                <span>Charger un Kbis</span>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG, PDF (max 10MB)
                </span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Données extraites
            </DialogTitle>
            <DialogDescription>
              Voici les informations extraites de {fileName}. Confirmez pour les appliquer au formulaire.
            </DialogDescription>
          </DialogHeader>

          {extractedData && (
            <div className="space-y-3 py-4">
              {extractedData.name && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Raison sociale</span>
                  <span className="font-medium">{extractedData.name}</span>
                </div>
              )}
              {extractedData.trade_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nom commercial</span>
                  <span className="font-medium">{extractedData.trade_name}</span>
                </div>
              )}
              {extractedData.legal_form && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Forme juridique</span>
                  <span className="font-medium">
                    {legalFormLabels[extractedData.legal_form] || extractedData.legal_form}
                  </span>
                </div>
              )}
              {extractedData.siret && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SIRET</span>
                  <span className="font-medium font-mono">{extractedData.siret}</span>
                </div>
              )}
              {extractedData.siren && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SIREN</span>
                  <span className="font-medium font-mono">{extractedData.siren}</span>
                </div>
              )}
              {extractedData.vat_number && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">N° TVA</span>
                  <span className="font-medium font-mono">{extractedData.vat_number}</span>
                </div>
              )}
              {extractedData.address && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Adresse</span>
                  <span className="font-medium text-right max-w-[200px]">{extractedData.address}</span>
                </div>
              )}
              {(extractedData.postal_code || extractedData.city) && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ville</span>
                  <span className="font-medium">
                    {extractedData.postal_code} {extractedData.city}
                  </span>
                </div>
              )}
              {extractedData.capital && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Capital</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(extractedData.capital)}
                  </span>
                </div>
              )}
              {extractedData.rcs && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">RCS</span>
                  <span className="font-medium">{extractedData.rcs}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel}>
              Annuler
            </Button>
            <Button onClick={handleConfirm}>
              Appliquer au formulaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
