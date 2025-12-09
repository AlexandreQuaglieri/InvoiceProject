import { z } from 'zod'

export const clientTypes = ['individual', 'professional'] as const

export const clientSchema = z.object({
  type: z.enum(clientTypes),
  name: z.string().min(1, 'Le nom est requis'),
  siret: z.string().optional(),
  vat_number: z.string().optional(),
  address: z.string().min(1, "L'adresse est requise"),
  postal_code: z.string().min(5, 'Le code postal est requis').max(10),
  city: z.string().min(1, 'La ville est requise'),
  country: z.string().default('France'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  notes: z.string().optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>
