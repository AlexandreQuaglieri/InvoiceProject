'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import {
  invoiceSchema,
  type InvoiceFormData,
  type InvoiceFormInput,
  vatRates,
  calculateInvoiceTotals,
  calculateLineTotal,
} from '@/lib/validations/invoice'
import type { Client, InvoiceWithRelations } from '@/types/database'

interface InvoiceFormProps {
  invoice?: InvoiceWithRelations | null
  clients: Client[]
  onSubmit: (data: InvoiceFormData) => Promise<void>
  isLoading: boolean
  // Mode embarqué (onboarding) : sections légères sans chrome Card redondant.
  embedded?: boolean
}

// Section du formulaire : Card autonome par défaut, simple section titrée en
// mode embarqué (le conteneur — panel d'onboarding — apporte déjà son cadre).
function FormSection({
  embedded,
  title,
  action,
  children,
}: {
  embedded: boolean
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  if (embedded) {
    if (!title) {
      return <section className="rounded-lg border bg-muted/30 p-4">{children}</section>
    }
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold">{title}</h3>
          {action}
        </div>
        {children}
      </section>
    )
  }
  if (!title) {
    return (
      <Card>
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className={action ? 'flex flex-row items-center justify-between' : undefined}>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export function InvoiceForm({ invoice, clients, onSubmit, isLoading, embedded = false }: InvoiceFormProps) {
  const t = useTranslations()

  const form = useForm<InvoiceFormInput, unknown, InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      client_id: invoice?.client_id || '',
      issue_date: invoice?.issue_date || new Date().toISOString().split('T')[0],
      due_date: invoice?.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_terms: invoice?.payment_terms || '',
      notes: invoice?.notes || '',
      discount_type: (invoice?.discount_type as 'percentage' | 'amount') || undefined,
      discount_value: invoice?.discount_value || undefined,
      items: invoice?.items?.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate,
      })) || [
        { description: '', quantity: 1, unit_price: 0, vat_rate: 20 }
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const watchItems = form.watch('items')
  const watchDiscountType = form.watch('discount_type')
  const watchDiscountValue = form.watch('discount_value')

  // Calculer les totaux en temps réel
  const totals = calculateInvoiceTotals(
    watchItems || [],
    watchDiscountType,
    watchDiscountValue
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Informations générales */}
        <FormSection embedded={embedded} title={t('invoices.details')}>
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('invoices.client')} *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('invoices.issueDate')} *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('invoices.dueDate')} *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="payment_terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('invoices.paymentTerms')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Paiement à 30 jours" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </FormSection>

        {/* Lignes de facture */}
        <FormSection
          embedded={embedded}
          title={t('invoices.items')}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: '', quantity: 1, unit_price: 0, vat_rate: 20 })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une ligne
            </Button>
          }
        >
            {fields.map((field, index) => {
              const item = watchItems?.[index]
              const lineTotal = item ? calculateLineTotal(item.quantity, item.unit_price, item.vat_rate) : { totalHt: 0, totalVat: 0, totalTtc: 0 }

              return (
                <div key={field.id} className="space-y-4 p-4 border rounded-lg relative">
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}

                  <FormField
                    control={form.control}
                    name={`items.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Description du produit ou service" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantité *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.001"
                              min="0.001"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.unit_price`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prix unitaire HT *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.vat_rate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TVA %</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseFloat(value))}
                            defaultValue={String(field.value)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vatRates.map((rate) => (
                                <SelectItem key={rate} value={String(rate)}>
                                  {rate}%
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col justify-end">
                      <p className="text-sm text-muted-foreground">Total HT</p>
                      <p className="font-medium">{formatCurrency(lineTotal.totalHt)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
        </FormSection>

        {/* Remise */}
        <FormSection embedded={embedded} title="Remise">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="discount_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de remise</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Aucune remise" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                        <SelectItem value="amount">Montant fixe (€)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchDiscountType && (
                <FormField
                  control={form.control}
                  name="discount_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Valeur {watchDiscountType === 'percentage' ? '(%)' : '(€)'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
        </FormSection>

        {/* Notes */}
        <FormSection embedded={embedded} title="Notes">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes internes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes ou conditions particulières..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </FormSection>

        {/* Totaux */}
        <FormSection embedded={embedded}>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total HT</span>
                <span className="font-medium">{formatCurrency(totals.totalHt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total TVA</span>
                <span className="font-medium">{formatCurrency(totals.totalVat)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total TTC</span>
                <span className="font-bold">{formatCurrency(totals.totalTtc)}</span>
              </div>
            </div>
        </FormSection>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
