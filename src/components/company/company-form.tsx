'use client'

import { useState, useImperativeHandle, forwardRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import {
  companySchema,
  type CompanyFormData,
  type CompanyFormInput,
  legalForms,
  vatRegimes,
  formsWithCapital,
  formsWithRcs,
} from '@/lib/validations/company'
import { createCompany, updateCompany } from '@/actions/company'
import { useLiveStoreActions } from '@/lib/realtime'
import type { Company } from '@/types/database'

export interface CompanyFormRef {
  setFormValues: (data: Partial<CompanyFormData>) => void
}

interface CompanyFormProps {
  company: Company | null
  // Mode embarqué (onboarding) : sections légères sans chrome Card redondant.
  embedded?: boolean
}

// Section du formulaire : Card autonome par défaut, simple section titrée en
// mode embarqué (le conteneur — panel d'onboarding — apporte déjà son cadre).
function FormSection({
  embedded,
  title,
  description,
  children,
}: {
  embedded: boolean
  title: string
  description: string
  children: React.ReactNode
}) {
  if (embedded) {
    return (
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {children}
      </section>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export const CompanyForm = forwardRef<CompanyFormRef, CompanyFormProps>(
  function CompanyForm({ company, embedded = false }, ref) {
  const t = useTranslations()
  const tLegal = useTranslations('legalForms')
  const tVat = useTranslations('vatRegimes')
  const { setCompany } = useLiveStoreActions()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<CompanyFormInput, unknown, CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name || '',
      trade_name: company?.trade_name || '',
      legal_form: company?.legal_form || 'auto_entrepreneur',
      siret: company?.siret || '',
      siren: company?.siren || '',
      vat_number: company?.vat_number || '',
      vat_regime: company?.vat_regime || 'franchise',
      address: company?.address || '',
      postal_code: company?.postal_code || '',
      city: company?.city || '',
      country: company?.country || 'France',
      email: company?.email || '',
      phone: company?.phone || '',
      website: company?.website || '',
      capital: company?.capital || undefined,
      rcs: company?.rcs || '',
      rm: company?.rm || '',
      iban: company?.iban || '',
      bic: company?.bic || '',
    },
  })

  // Exposer une méthode pour pré-remplir le formulaire depuis l'extérieur
  useImperativeHandle(ref, () => ({
    setFormValues: (data: Partial<CompanyFormData>) => {
      const entries = Object.entries(data) as [
        keyof CompanyFormInput,
        CompanyFormInput[keyof CompanyFormInput],
      ][]
      entries.forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          form.setValue(key, value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      })
    },
  }))

  const watchLegalForm = form.watch('legal_form')
  const showCapital = formsWithCapital.includes(watchLegalForm)
  const showRcs = formsWithRcs.includes(watchLegalForm)

  const onSubmit = async (data: CompanyFormData) => {
    setIsLoading(true)
    try {
      const result = company ? await updateCompany(data) : await createCompany(data)

      if (result.success) {
        // Write-through : l'action renvoie la ligne complète, le store live
        // reflète immédiatement la création/mise à jour (Realtime réconcilie).
        if (result.data) setCompany(result.data)
        toast.success(company ? 'Entreprise mise à jour' : 'Entreprise créée')
      } else {
        toast.error(result.error || 'Une erreur est survenue')
      }
    } catch (error) {
      console.error('Enregistrement de l\'entreprise échoué', error)
      toast.error('Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Informations légales */}
        <FormSection
          embedded={embedded}
          title={t('company.legalInfo')}
          description="Raison sociale, SIRET, forme juridique..."
        >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.name')} *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ma Société SAS" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trade_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.tradeName')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom commercial (optionnel)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="legal_form"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.legalForm')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {legalForms.map((form) => (
                          <SelectItem key={form} value={form}>
                            {tLegal(form)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vat_regime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.vatRegime')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vatRegimes.map((regime) => (
                          <SelectItem key={regime} value={regime}>
                            {tVat(regime)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="siret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.siret')} *</FormLabel>
                    <FormControl>
                      <Input placeholder="12345678901234" maxLength={14} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="siren"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.siren')}</FormLabel>
                    <FormControl>
                      <Input placeholder="123456789" maxLength={9} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vat_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.vatNumber')}</FormLabel>
                    <FormControl>
                      <Input placeholder="FR12345678901" {...field} />
                    </FormControl>
                    <FormDescription>N° TVA intracommunautaire</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {(showCapital || showRcs) && (
              <div className="grid gap-4 md:grid-cols-3">
                {showCapital && (
                  <FormField
                    control={form.control}
                    name="capital"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('company.capital')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="10000"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? Number(e.target.value) : undefined)
                            }
                          />
                        </FormControl>
                        <FormDescription>En euros</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {showRcs && (
                  <FormField
                    control={form.control}
                    name="rcs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('company.rcs')}</FormLabel>
                        <FormControl>
                          <Input placeholder="Paris B 123 456 789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="rm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('company.rm')}</FormLabel>
                      <FormControl>
                        <Input placeholder="RM Paris" {...field} />
                      </FormControl>
                      <FormDescription>Si artisan</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
        </FormSection>

        {/* Coordonnées */}
        <FormSection
          embedded={embedded}
          title={t('company.contactInfo')}
          description="Adresse, email, téléphone..."
        >
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('company.address')} *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="123 rue de la Paix" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.postalCode')} *</FormLabel>
                    <FormControl>
                      <Input placeholder="75001" maxLength={5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.city')} *</FormLabel>
                    <FormControl>
                      <Input placeholder="Paris" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.country')}</FormLabel>
                    <FormControl>
                      <Input placeholder="France" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.email')} *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@exemple.fr" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.phone')}</FormLabel>
                    <FormControl>
                      <Input placeholder="01 23 45 67 89" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.website')}</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.exemple.fr" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
        </FormSection>

        {/* Coordonnées bancaires */}
        <FormSection
          embedded={embedded}
          title={t('company.bankInfo')}
          description="IBAN, BIC pour les paiements."
        >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="iban"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.iban')}</FormLabel>
                    <FormControl>
                      <Input placeholder="FR76 1234 5678 9012 3456 7890 123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.bic')}</FormLabel>
                    <FormControl>
                      <Input placeholder="BNPAFRPP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
        </FormSection>

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Form>
  )
})
