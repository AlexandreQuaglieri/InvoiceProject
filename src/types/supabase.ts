export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string
          city: string
          company_id: string
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string
          siret: string | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at: string | null
          vat_number: string | null
        }
        Insert: {
          address: string
          city: string
          company_id: string
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code: string
          siret?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string | null
          vat_number?: string | null
        }
        Update: {
          address?: string
          city?: string
          company_id?: string
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string
          siret?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string | null
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string
          bic: string | null
          capital: number | null
          city: string
          country: string | null
          created_at: string | null
          email: string
          iban: string | null
          id: string
          legal_form: Database["public"]["Enums"]["legal_form"]
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string
          rcs: string | null
          rm: string | null
          siren: string | null
          siret: string
          trade_name: string | null
          updated_at: string | null
          user_id: string
          vat_number: string | null
          vat_regime: Database["public"]["Enums"]["vat_regime"]
          website: string | null
        }
        Insert: {
          address: string
          bic?: string | null
          capital?: number | null
          city: string
          country?: string | null
          created_at?: string | null
          email: string
          iban?: string | null
          id?: string
          legal_form: Database["public"]["Enums"]["legal_form"]
          logo_url?: string | null
          name: string
          phone?: string | null
          postal_code: string
          rcs?: string | null
          rm?: string | null
          siren?: string | null
          siret: string
          trade_name?: string | null
          updated_at?: string | null
          user_id: string
          vat_number?: string | null
          vat_regime?: Database["public"]["Enums"]["vat_regime"]
          website?: string | null
        }
        Update: {
          address?: string
          bic?: string | null
          capital?: number | null
          city?: string
          country?: string | null
          created_at?: string | null
          email?: string
          iban?: string | null
          id?: string
          legal_form?: Database["public"]["Enums"]["legal_form"]
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string
          rcs?: string | null
          rm?: string | null
          siren?: string | null
          siret?: string
          trade_name?: string | null
          updated_at?: string | null
          user_id?: string
          vat_number?: string | null
          vat_regime?: Database["public"]["Enums"]["vat_regime"]
          website?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["document_type"]
          url: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          name: string
          type: Database["public"]["Enums"]["document_type"]
          url: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["document_type"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          position: number
          quantity: number
          total_ht: number
          total_ttc: number
          total_vat: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          position?: number
          quantity?: number
          total_ht: number
          total_ttc: number
          total_vat: number
          unit_price: number
          vat_rate?: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          position?: number
          quantity?: number
          total_ht?: number
          total_ttc?: number
          total_vat?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          company_id: string
          created_at: string | null
          discount_type: string | null
          discount_value: number | null
          due_date: string
          id: string
          issue_date: string
          notes: string | null
          number: string
          paid_at: string | null
          payment_terms: string | null
          pdf_url: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_ht: number
          total_ttc: number
          total_vat: number
          updated_at: string | null
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string | null
          discount_type?: string | null
          discount_value?: number | null
          due_date: string
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          paid_at?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_ht?: number
          total_ttc?: number
          total_vat?: number
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          paid_at?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_ht?: number
          total_ttc?: number
          total_vat?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          claude_api_key: string | null
          created_at: string | null
          id: string
          invoice_next_number: number | null
          invoice_prefix: string | null
          locale: string | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          claude_api_key?: string | null
          created_at?: string | null
          id?: string
          invoice_next_number?: number | null
          invoice_prefix?: string | null
          locale?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          claude_api_key?: string | null
          created_at?: string | null
          id?: string
          invoice_next_number?: number | null
          invoice_prefix?: string | null
          locale?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      client_type: "individual" | "professional"
      document_type: "kbis" | "rib" | "logo" | "other"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      legal_form:
        | "auto_entrepreneur"
        | "ei"
        | "eurl"
        | "sarl"
        | "sasu"
        | "sas"
        | "sa"
        | "association"
        | "profession_liberale"
      vat_regime: "franchise" | "reel_simplifie" | "reel_normal"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      client_type: ["individual", "professional"],
      document_type: ["kbis", "rib", "logo", "other"],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      legal_form: [
        "auto_entrepreneur",
        "ei",
        "eurl",
        "sarl",
        "sasu",
        "sas",
        "sa",
        "association",
        "profession_liberale",
      ],
      vat_regime: ["franchise", "reel_simplifie", "reel_normal"],
    },
  },
} as const
