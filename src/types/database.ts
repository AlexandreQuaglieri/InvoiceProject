// Types générés pour Supabase
// Ces types correspondent au schéma SQL dans supabase/schema.sql

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Enums
export type LegalForm =
  | 'auto_entrepreneur'
  | 'ei'
  | 'eurl'
  | 'sarl'
  | 'sasu'
  | 'sas'
  | 'sa'
  | 'association'
  | 'profession_liberale'

export type VatRegime = 'franchise' | 'reel_simplifie' | 'reel_normal'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'

export type ClientType = 'individual' | 'professional'

export type DocumentType = 'kbis' | 'rib' | 'logo' | 'other'

// Database types
export interface Database {
  public: {
    Tables: {
      user_settings: {
        Row: {
          id: string
          user_id: string
          claude_api_key: string | null
          invoice_prefix: string
          invoice_next_number: number
          locale: string
          theme: string
          chorus_pro_client_id: string | null
          chorus_pro_client_secret: string | null
          chorus_pro_login: string | null
          chorus_pro_password: string | null
          chorus_pro_sandbox: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          claude_api_key?: string | null
          invoice_prefix?: string
          invoice_next_number?: number
          locale?: string
          theme?: string
          chorus_pro_client_id?: string | null
          chorus_pro_client_secret?: string | null
          chorus_pro_login?: string | null
          chorus_pro_password?: string | null
          chorus_pro_sandbox?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          claude_api_key?: string | null
          invoice_prefix?: string
          invoice_next_number?: number
          locale?: string
          theme?: string
          chorus_pro_client_id?: string | null
          chorus_pro_client_secret?: string | null
          chorus_pro_login?: string | null
          chorus_pro_password?: string | null
          chorus_pro_sandbox?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          user_id: string
          name: string
          trade_name: string | null
          legal_form: LegalForm
          siret: string
          siren: string | null
          vat_number: string | null
          vat_regime: VatRegime
          address: string
          postal_code: string
          city: string
          country: string
          email: string
          phone: string | null
          website: string | null
          capital: number | null
          rcs: string | null
          rm: string | null
          iban: string | null
          bic: string | null
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          trade_name?: string | null
          legal_form: LegalForm
          siret: string
          siren?: string | null
          vat_number?: string | null
          vat_regime?: VatRegime
          address: string
          postal_code: string
          city: string
          country?: string
          email: string
          phone?: string | null
          website?: string | null
          capital?: number | null
          rcs?: string | null
          rm?: string | null
          iban?: string | null
          bic?: string | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          trade_name?: string | null
          legal_form?: LegalForm
          siret?: string
          siren?: string | null
          vat_number?: string | null
          vat_regime?: VatRegime
          address?: string
          postal_code?: string
          city?: string
          country?: string
          email?: string
          phone?: string | null
          website?: string | null
          capital?: number | null
          rcs?: string | null
          rm?: string | null
          iban?: string | null
          bic?: string | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          company_id: string
          type: ClientType
          name: string
          siret: string | null
          vat_number: string | null
          address: string
          postal_code: string
          city: string
          country: string
          email: string | null
          phone: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          type?: ClientType
          name: string
          siret?: string | null
          vat_number?: string | null
          address: string
          postal_code: string
          city: string
          country?: string
          email?: string | null
          phone?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          type?: ClientType
          name?: string
          siret?: string | null
          vat_number?: string | null
          address?: string
          postal_code?: string
          city?: string
          country?: string
          email?: string | null
          phone?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          company_id: string
          client_id: string
          number: string
          status: InvoiceStatus
          issue_date: string
          due_date: string
          paid_at: string | null
          payment_terms: string | null
          notes: string | null
          discount_type: string | null
          discount_value: number
          total_ht: number
          total_vat: number
          total_ttc: number
          pdf_url: string | null
          pdp_deposit_id: string | null
          pdp_transmitted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          client_id: string
          number: string
          status?: InvoiceStatus
          issue_date?: string
          due_date: string
          paid_at?: string | null
          payment_terms?: string | null
          notes?: string | null
          discount_type?: string | null
          discount_value?: number
          total_ht?: number
          total_vat?: number
          total_ttc?: number
          pdf_url?: string | null
          pdp_deposit_id?: string | null
          pdp_transmitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          client_id?: string
          number?: string
          status?: InvoiceStatus
          issue_date?: string
          due_date?: string
          paid_at?: string | null
          payment_terms?: string | null
          notes?: string | null
          discount_type?: string | null
          discount_value?: number
          total_ht?: number
          total_vat?: number
          total_ttc?: number
          pdf_url?: string | null
          pdp_deposit_id?: string | null
          pdp_transmitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          vat_rate: number
          total_ht: number
          total_vat: number
          total_ttc: number
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          quantity?: number
          unit_price: number
          vat_rate?: number
          total_ht?: number
          total_vat?: number
          total_ttc?: number
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          description?: string
          quantity?: number
          unit_price?: number
          vat_rate?: number
          total_ht?: number
          total_vat?: number
          total_ttc?: number
          position?: number
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          company_id: string
          type: DocumentType
          name: string
          url: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          type: DocumentType
          name: string
          url: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          type?: DocumentType
          name?: string
          url?: string
          created_at?: string
        }
      }
    }
    Enums: {
      legal_form: LegalForm
      vat_regime: VatRegime
      invoice_status: InvoiceStatus
      client_type: ClientType
      document_type: DocumentType
    }
  }
}

// Helper types pour utilisation simplifiée
export type UserSettings = Database['public']['Tables']['user_settings']['Row']
export type UserSettingsInsert = Database['public']['Tables']['user_settings']['Insert']
export type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update']

export type Company = Database['public']['Tables']['companies']['Row']
export type CompanyInsert = Database['public']['Tables']['companies']['Insert']
export type CompanyUpdate = Database['public']['Tables']['companies']['Update']

export type Client = Database['public']['Tables']['clients']['Row']
export type ClientInsert = Database['public']['Tables']['clients']['Insert']
export type ClientUpdate = Database['public']['Tables']['clients']['Update']

export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']
export type InvoiceUpdate = Database['public']['Tables']['invoices']['Update']

export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
export type InvoiceItemInsert = Database['public']['Tables']['invoice_items']['Insert']
export type InvoiceItemUpdate = Database['public']['Tables']['invoice_items']['Update']

export type Document = Database['public']['Tables']['documents']['Row']
export type DocumentInsert = Database['public']['Tables']['documents']['Insert']
export type DocumentUpdate = Database['public']['Tables']['documents']['Update']

// Quote types
export interface Quote {
  id: string
  user_id: string
  company_id: string
  client_id: string
  quote_number: string
  issue_date: string
  validity_date: string
  status: QuoteStatus
  subtotal: number
  tax_amount: number
  total: number
  converted_invoice_id: string | null
  notes: string | null
  terms: string | null
  created_at: string
  updated_at: string
}

export interface QuoteItem {
  id: string
  quote_id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  total: number
  position: number
  created_at: string
}

// Types avec relations
export type InvoiceWithRelations = Invoice & {
  client: Client
  items: InvoiceItem[]
}

export type QuoteWithRelations = Quote & {
  client: Client
  items: QuoteItem[]
}

export type CompanyWithClients = Company & {
  clients: Client[]
}
