import { z } from 'zod'

export const legalForms = [
  'auto_entrepreneur',
  'ei',
  'eurl',
  'sarl',
  'sasu',
  'sas',
  'sa',
  'association',
  'profession_liberale',
] as const

export const vatRegimes = ['franchise', 'reel_simplifie', 'reel_normal'] as const

export const companySchema = z.object({
  name: z.string().min(1, 'La raison sociale est requise'),
  trade_name: z.string().optional(),
  legal_form: z.enum(legalForms),
  siret: z
    .string()
    .min(14, 'Le SIRET doit contenir 14 chiffres')
    .max(14, 'Le SIRET doit contenir 14 chiffres')
    .regex(/^\d{14}$/, 'Le SIRET doit contenir uniquement des chiffres'),
  siren: z.string().optional(),
  vat_number: z.string().optional(),
  vat_regime: z.enum(vatRegimes),
  address: z.string().min(1, "L'adresse est requise"),
  postal_code: z
    .string()
    .min(5, 'Le code postal doit contenir 5 chiffres')
    .max(5, 'Le code postal doit contenir 5 chiffres'),
  city: z.string().min(1, 'La ville est requise'),
  country: z.string().default('France'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  website: z.string().optional(),
  capital: z.number().optional(),
  rcs: z.string().optional(),
  rm: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  logo_url: z.string().optional(),
})

export type CompanyFormData = z.infer<typeof companySchema>

// Champs requis selon la forme juridique
export const requiredFieldsByLegalForm: Record<string, string[]> = {
  auto_entrepreneur: ['name', 'siret', 'address', 'postal_code', 'city', 'email'],
  ei: ['name', 'siret', 'address', 'postal_code', 'city', 'email'],
  eurl: ['name', 'siret', 'address', 'postal_code', 'city', 'email', 'capital', 'rcs'],
  sarl: ['name', 'siret', 'address', 'postal_code', 'city', 'email', 'capital', 'rcs'],
  sasu: ['name', 'siret', 'address', 'postal_code', 'city', 'email', 'capital', 'rcs'],
  sas: ['name', 'siret', 'address', 'postal_code', 'city', 'email', 'capital', 'rcs'],
  sa: ['name', 'siret', 'address', 'postal_code', 'city', 'email', 'capital', 'rcs'],
  association: ['name', 'siret', 'address', 'postal_code', 'city', 'email'],
  profession_liberale: ['name', 'siret', 'address', 'postal_code', 'city', 'email'],
}

// Les formes juridiques qui nécessitent un capital social
export const formsWithCapital = ['eurl', 'sarl', 'sasu', 'sas', 'sa']

// Les formes juridiques qui nécessitent un RCS
export const formsWithRcs = ['eurl', 'sarl', 'sasu', 'sas', 'sa']
