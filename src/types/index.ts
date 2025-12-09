// Types pour l'application de facturation

// Formes juridiques françaises
export type LegalForm =
  | 'auto_entrepreneur'
  | 'ei' // Entreprise individuelle
  | 'eurl'
  | 'sarl'
  | 'sasu'
  | 'sas'
  | 'sa'
  | 'association'
  | 'profession_liberale'

// Régimes TVA
export type VatRegime =
  | 'franchise' // Non assujetti (auto-entrepreneurs, etc.)
  | 'reel_simplifie'
  | 'reel_normal'

// Taux de TVA français
export type VatRate = 0 | 5.5 | 10 | 20

// Statuts de facture
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

// Type de client
export type ClientType = 'individual' | 'professional'

// Informations entreprise
export interface Company {
  id: string
  user_id: string
  name: string // Raison sociale
  trade_name?: string // Nom commercial
  legal_form: LegalForm
  siret: string
  siren?: string
  vat_number?: string // N° TVA intracommunautaire
  vat_regime: VatRegime
  address: string
  postal_code: string
  city: string
  country: string
  email: string
  phone?: string
  website?: string
  capital?: number // Capital social (si applicable)
  rcs?: string // RCS
  rm?: string // Registre des métiers
  iban?: string
  bic?: string
  logo_url?: string
  created_at: string
  updated_at: string
}

// Client
export interface Client {
  id: string
  company_id: string
  type: ClientType
  name: string // Nom ou raison sociale
  siret?: string
  vat_number?: string
  address: string
  postal_code: string
  city: string
  country: string
  email: string
  phone?: string
  notes?: string
  created_at: string
  updated_at: string
}

// Ligne de facture
export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number // Prix unitaire HT
  vat_rate: VatRate
  total_ht: number
  total_vat: number
  total_ttc: number
  position: number // Ordre d'affichage
}

// Facture
export interface Invoice {
  id: string
  company_id: string
  client_id: string
  number: string // Numéro de facture (ex: FAC-2024-001)
  status: InvoiceStatus
  issue_date: string
  due_date: string
  payment_terms?: string
  notes?: string
  discount_type?: 'percentage' | 'amount'
  discount_value?: number
  total_ht: number
  total_vat: number
  total_ttc: number
  pdf_url?: string
  created_at: string
  updated_at: string
  paid_at?: string
  // Relations
  client?: Client
  items?: InvoiceItem[]
}

// Configuration utilisateur
export interface UserSettings {
  id: string
  user_id: string
  claude_api_key?: string // Clé API perso (BYOK)
  invoice_prefix: string // Préfixe factures (ex: "FAC")
  invoice_next_number: number
  locale: 'fr' | 'en'
  theme: 'light' | 'dark' | 'system'
  created_at: string
  updated_at: string
}

// Document uploadé
export interface Document {
  id: string
  company_id: string
  type: 'kbis' | 'rib' | 'logo' | 'other'
  name: string
  url: string
  created_at: string
}
