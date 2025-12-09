'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Plus, Trash2 } from 'lucide-react'
import * as z from 'zod'

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

import type { Client, QuoteWithRelations } from '@/types/database'

const quoteItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'Description requise'),
  quantity: z.number().min(0.001, 'Quantité requise'),
  unit_price: z.number().min(0, 'Prix requis'),
  tax_rate: z.number().min(0).max(100),
})

const quoteSchema = z.object({
  client_id: z.string().min(1, 'Client requis'),
  issue_date: z.string().min(1, 'Date requise'),
  validity_date: z.string().min(1, 'Date de validité requise'),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(quoteItemSchema).min(1, 'Au moins une ligne requise'),
})

export type QuoteFormData = z.infer<typeof quoteSchema>

const vatRates = [0, 5.5, 10, 20]

interface QuoteFormProps {
  quote?: QuoteWithRelations | null
  clients: Client[]
  onSubmit: (data: QuoteFormData) => Promise<void>
  isLoading: boolean
}

export function QuoteForm({ quote, clients, onSubmit, isLoading }: QuoteFormProps) {
  const t = useTranslations()

  // Date de validité par défaut : 30 jours
  const defaultValidityDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema) as any,
    defaultValues: {
      client_id: quote?.client_id || '',
      issue_date: quote?.issue_date || new Date().toISOString().split('T')[0],
      validity_date: quote?.validity_date || defaultValidityDate,
      notes: quote?.notes || '',
      terms: quote?.terms || '',
      items: quote?.items?.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
      })) || [
        { description: '', quantity: 1, unit_price: 0, tax_rate: 0 }
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const watchItems = form.watch('items')

  // Calculer les totaux
  const calculateTotals = () => {
    let subtotal = 0
    let taxAmount = 0

    watchItems?.forEach(item => {
      const lineTotal = (item.quantity || 0) * (item.unit_price || 0)
      const lineTax = lineTotal * ((item.tax_rate || 0) / 100)
      subtotal += lineTotal
      taxAmount += lineTax
    })

    return {
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    }
  }

  const totals = calculateTotals()

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
        <Card>
          <CardHeader>
            <CardTitle>{t('quotes.details')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.client')} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
                    <FormLabel>{t('quotes.issueDate')} *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="validity_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('quotes.validityDate')} *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Lignes du devis */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('quotes.items')}</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: '', quantity: 1, unit_price: 0, tax_rate: 0 })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une ligne
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => {
              const item = watchItems?.[index]
              const lineTotal = (item?.quantity || 0) * (item?.unit_price || 0)

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
                      name={`items.${index}.tax_rate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TVA %</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseFloat(value))}
                            value={String(field.value)}
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
                      <p className="font-medium">{formatCurrency(lineTotal)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Notes et conditions */}
        <Card>
          <CardHeader>
            <CardTitle>Notes et conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes internes..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conditions particulières</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Conditions du devis..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Totaux */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sous-total HT</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TVA</span>
                <span className="font-medium">{formatCurrency(totals.taxAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total TTC</span>
                <span className="font-bold">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

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
