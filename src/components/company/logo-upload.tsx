'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Upload, X, Loader2 } from 'lucide-react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { uploadLogo } from '@/actions/company'

interface LogoUploadProps {
  currentLogo: string | null
  companyId: string | null
}

export function LogoUpload({ currentLogo, companyId }: LogoUploadProps) {
  const t = useTranslations()
  const [isLoading, setIsLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentLogo)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Prévisualisation
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const result = await uploadLogo(formData)

      if (result.success) {
        toast.success('Logo mis à jour')
        if (result.url) {
          setPreview(result.url)
        }
      } else {
        toast.error(result.error || 'Erreur lors de l\'upload')
        setPreview(currentLogo)
      }
    } catch (error) {
      toast.error('Erreur lors de l\'upload')
      setPreview(currentLogo)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemove = () => {
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!companyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('company.logo')}</CardTitle>
          <CardDescription>Enregistrez d'abord votre entreprise pour ajouter un logo.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('company.logo')}</CardTitle>
        <CardDescription>Votre logo apparaîtra sur vos factures.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted">
            {preview ? (
              <>
                <Image
                  src={preview}
                  alt="Logo"
                  fill
                  className="object-contain p-2"
                />
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button type="button" variant="outline" onClick={handleClick} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Upload...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('company.uploadLogo')}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP ou SVG. Max 2MB.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
