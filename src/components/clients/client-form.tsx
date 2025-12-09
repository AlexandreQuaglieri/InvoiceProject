'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'

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

import { clientSchema, type ClientFormData, clientTypes } from '@/lib/validations/client'
import type { Client } from '@/types/database'

interface ClientFormProps {
  client?: Client | null
  onSubmit: (data: ClientFormData) => Promise<void>
  isLoading: boolean
}

export function ClientForm({ client, onSubmit, isLoading }: ClientFormProps) {
  const t = useTranslations()

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema) as any,
    defaultValues: {
      type: client?.type || 'professional',
      name: client?.name || '',
      siret: client?.siret || '',
      vat_number: client?.vat_number || '',
      address: client?.address || '',
      postal_code: client?.postal_code || '',
      city: client?.city || '',
      country: client?.country || 'France',
      email: client?.email || '',
      phone: client?.phone || '',
      notes: client?.notes || '',
    },
  })

  const watchType = form.watch('type')

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('clients.type')} *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="individual">{t('clients.individual')}</SelectItem>
                  <SelectItem value="professional">{t('clients.professional')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('clients.name')} *</FormLabel>
              <FormControl>
                <Input placeholder="Nom ou raison sociale" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {watchType === 'professional' && (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="siret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('clients.siret')}</FormLabel>
                  <FormControl>
                    <Input placeholder="12345678901234" maxLength={14} {...field} />
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
                  <FormLabel>{t('clients.vatNumber')}</FormLabel>
                  <FormControl>
                    <Input placeholder="FR12345678901" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('clients.address')} *</FormLabel>
              <FormControl>
                <Textarea placeholder="Adresse complète" {...field} />
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
                <FormLabel>{t('clients.postalCode')} *</FormLabel>
                <FormControl>
                  <Input placeholder="75001" {...field} />
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
                <FormLabel>{t('clients.city')} *</FormLabel>
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
                <FormLabel>{t('clients.country')}</FormLabel>
                <FormControl>
                  <Input placeholder="France" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('clients.email')}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="client@exemple.fr" {...field} />
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
                <FormLabel>{t('clients.phone')}</FormLabel>
                <FormControl>
                  <Input placeholder="01 23 45 67 89" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('clients.notes')}</FormLabel>
              <FormControl>
                <Textarea placeholder="Notes internes (optionnel)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
