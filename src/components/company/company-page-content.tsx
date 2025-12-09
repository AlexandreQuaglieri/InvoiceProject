'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { CompanyForm, type CompanyFormRef } from '@/components/company/company-form'
import { LogoUpload } from '@/components/company/logo-upload'
import { DocumentExtractor } from '@/components/company/document-extractor'
import type { Company } from '@/types/database'
import type { CompanyFormData } from '@/lib/validations/company'

interface CompanyPageContentProps {
  company: Company | null
}

export function CompanyPageContent({ company }: CompanyPageContentProps) {
  const t = useTranslations()
  const formRef = useRef<CompanyFormRef>(null)

  const handleDataExtracted = (data: Partial<CompanyFormData>) => {
    if (formRef.current) {
      formRef.current.setFormValues(data)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('company.title')}</h1>
        <p className="text-muted-foreground">
          {company
            ? 'Modifiez les informations de votre entreprise.'
            : 'Configurez les informations de votre entreprise pour commencer à facturer.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <CompanyForm ref={formRef} company={company} />
        </div>
        <div className="space-y-6">
          <DocumentExtractor onDataExtracted={handleDataExtracted} />
          <LogoUpload currentLogo={company?.logo_url || null} companyId={company?.id || null} />
        </div>
      </div>
    </div>
  )
}
