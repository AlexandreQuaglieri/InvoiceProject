-- =====================================================
-- FACTUR-IA - Schéma de base de données
-- =====================================================
-- Exécuter ce script dans Supabase SQL Editor
-- =====================================================

-- Note: gen_random_uuid() est natif dans PostgreSQL 13+ (utilisé par Supabase)

-- =====================================================
-- TYPES ENUM
-- =====================================================

-- Formes juridiques
CREATE TYPE legal_form AS ENUM (
  'auto_entrepreneur',
  'ei',
  'eurl',
  'sarl',
  'sasu',
  'sas',
  'sa',
  'association',
  'profession_liberale'
);

-- Régimes TVA
CREATE TYPE vat_regime AS ENUM (
  'franchise',
  'reel_simplifie',
  'reel_normal'
);

-- Statuts de facture
CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled'
);

-- Type de client
CREATE TYPE client_type AS ENUM (
  'individual',
  'professional'
);

-- Type de document
CREATE TYPE document_type AS ENUM (
  'kbis',
  'rib',
  'logo',
  'other'
);

-- =====================================================
-- TABLE: user_settings (extension de auth.users)
-- =====================================================

CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  claude_api_key TEXT, -- Clé API Claude personnelle (chiffrée)
  invoice_prefix VARCHAR(10) DEFAULT 'FAC',
  invoice_next_number INTEGER DEFAULT 1,
  locale VARCHAR(5) DEFAULT 'fr',
  theme VARCHAR(10) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: companies (entreprises)
-- =====================================================

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Informations légales
  name VARCHAR(255) NOT NULL, -- Raison sociale
  trade_name VARCHAR(255), -- Nom commercial
  legal_form legal_form NOT NULL,
  siret VARCHAR(14) NOT NULL,
  siren VARCHAR(9),
  vat_number VARCHAR(20), -- N° TVA intracommunautaire
  vat_regime vat_regime NOT NULL DEFAULT 'franchise',

  -- Adresse
  address TEXT NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(100) DEFAULT 'France',

  -- Contact
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  website VARCHAR(255),

  -- Infos supplémentaires (selon forme juridique)
  capital DECIMAL(15, 2), -- Capital social
  rcs VARCHAR(100), -- RCS (ville)
  rm VARCHAR(100), -- Registre des métiers

  -- Coordonnées bancaires
  iban VARCHAR(34),
  bic VARCHAR(11),

  -- Logo
  logo_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche par user
CREATE INDEX idx_companies_user_id ON companies(user_id);

-- =====================================================
-- TABLE: clients
-- =====================================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,

  -- Informations
  type client_type NOT NULL DEFAULT 'professional',
  name VARCHAR(255) NOT NULL, -- Nom ou raison sociale
  siret VARCHAR(14),
  vat_number VARCHAR(20),

  -- Adresse
  address TEXT NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(100) DEFAULT 'France',

  -- Contact
  email VARCHAR(255),
  phone VARCHAR(20),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche
CREATE INDEX idx_clients_company_id ON clients(company_id);
CREATE INDEX idx_clients_name ON clients(name);

-- =====================================================
-- TABLE: invoices (factures)
-- =====================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE RESTRICT NOT NULL,

  -- Numérotation
  number VARCHAR(50) NOT NULL, -- Ex: FAC-2024-001

  -- Statut
  status invoice_status NOT NULL DEFAULT 'draft',

  -- Dates
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,

  -- Conditions
  payment_terms TEXT,
  notes TEXT,

  -- Remise globale
  discount_type VARCHAR(10), -- 'percentage' ou 'amount'
  discount_value DECIMAL(15, 2) DEFAULT 0,

  -- Totaux (calculés)
  total_ht DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_vat DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_ttc DECIMAL(15, 2) NOT NULL DEFAULT 0,

  -- PDF généré
  pdf_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX idx_invoices_number ON invoices(number);

-- Contrainte d'unicité sur le numéro de facture par entreprise
CREATE UNIQUE INDEX idx_invoices_unique_number ON invoices(company_id, number);

-- =====================================================
-- TABLE: invoice_items (lignes de facture)
-- =====================================================

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,

  -- Détails
  description TEXT NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15, 2) NOT NULL, -- Prix unitaire HT
  vat_rate DECIMAL(5, 2) NOT NULL DEFAULT 20, -- Taux TVA (0, 5.5, 10, 20)

  -- Totaux (calculés)
  total_ht DECIMAL(15, 2) NOT NULL,
  total_vat DECIMAL(15, 2) NOT NULL,
  total_ttc DECIMAL(15, 2) NOT NULL,

  -- Ordre d'affichage
  position INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- =====================================================
-- TABLE: documents (fichiers uploadés)
-- =====================================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,

  type document_type NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_documents_company_id ON documents(company_id);

-- =====================================================
-- FONCTIONS TRIGGERS
-- =====================================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer les totaux d'une ligne de facture
CREATE OR REPLACE FUNCTION calculate_invoice_item_totals()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_ht = ROUND(NEW.quantity * NEW.unit_price, 2);
  NEW.total_vat = ROUND(NEW.total_ht * NEW.vat_rate / 100, 2);
  NEW.total_ttc = NEW.total_ht + NEW.total_vat;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour recalculer les totaux d'une facture
CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
  v_total_ht DECIMAL(15, 2);
  v_total_vat DECIMAL(15, 2);
  v_discount DECIMAL(15, 2);
  v_discount_type VARCHAR(10);
  v_discount_value DECIMAL(15, 2);
BEGIN
  -- Déterminer l'ID de la facture
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  -- Calculer les totaux des lignes
  SELECT
    COALESCE(SUM(total_ht), 0),
    COALESCE(SUM(total_vat), 0)
  INTO v_total_ht, v_total_vat
  FROM invoice_items
  WHERE invoice_id = v_invoice_id;

  -- Récupérer la remise
  SELECT discount_type, COALESCE(discount_value, 0)
  INTO v_discount_type, v_discount_value
  FROM invoices
  WHERE id = v_invoice_id;

  -- Appliquer la remise
  IF v_discount_type = 'percentage' AND v_discount_value > 0 THEN
    v_discount := ROUND(v_total_ht * v_discount_value / 100, 2);
    v_total_ht := v_total_ht - v_discount;
    -- Recalculer la TVA sur le montant remisé (simplifié)
    v_total_vat := ROUND(v_total_vat * (1 - v_discount_value / 100), 2);
  ELSIF v_discount_type = 'amount' AND v_discount_value > 0 THEN
    v_total_ht := v_total_ht - v_discount_value;
  END IF;

  -- Mettre à jour la facture
  UPDATE invoices
  SET
    total_ht = v_total_ht,
    total_vat = v_total_vat,
    total_ttc = v_total_ht + v_total_vat,
    updated_at = NOW()
  WHERE id = v_invoice_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour créer les settings utilisateur à l'inscription
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Triggers updated_at
CREATE TRIGGER trigger_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger calcul totaux ligne de facture
CREATE TRIGGER trigger_calculate_item_totals
  BEFORE INSERT OR UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION calculate_invoice_item_totals();

-- Trigger recalcul totaux facture
CREATE TRIGGER trigger_recalculate_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_invoice_totals();

-- Trigger création settings utilisateur
CREATE TRIGGER trigger_create_user_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_settings();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Activer RLS sur toutes les tables
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policies pour user_settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies pour companies
CREATE POLICY "Users can view own companies"
  ON companies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own companies"
  ON companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own companies"
  ON companies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own companies"
  ON companies FOR DELETE
  USING (auth.uid() = user_id);

-- Policies pour clients (via company)
CREATE POLICY "Users can view clients of own companies"
  ON clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = clients.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert clients to own companies"
  ON clients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = clients.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update clients of own companies"
  ON clients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = clients.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete clients of own companies"
  ON clients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = clients.company_id
      AND companies.user_id = auth.uid()
    )
  );

-- Policies pour invoices (via company)
CREATE POLICY "Users can view invoices of own companies"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = invoices.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert invoices to own companies"
  ON invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = invoices.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoices of own companies"
  ON invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = invoices.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete invoices of own companies"
  ON invoices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = invoices.company_id
      AND companies.user_id = auth.uid()
    )
  );

-- Policies pour invoice_items (via invoice -> company)
CREATE POLICY "Users can view invoice items of own invoices"
  ON invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN companies ON companies.id = invoices.company_id
      WHERE invoices.id = invoice_items.invoice_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert invoice items to own invoices"
  ON invoice_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN companies ON companies.id = invoices.company_id
      WHERE invoices.id = invoice_items.invoice_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoice items of own invoices"
  ON invoice_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN companies ON companies.id = invoices.company_id
      WHERE invoices.id = invoice_items.invoice_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete invoice items of own invoices"
  ON invoice_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN companies ON companies.id = invoices.company_id
      WHERE invoices.id = invoice_items.invoice_id
      AND companies.user_id = auth.uid()
    )
  );

-- Policies pour documents (via company)
CREATE POLICY "Users can view documents of own companies"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = documents.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert documents to own companies"
  ON documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = documents.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete documents of own companies"
  ON documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = documents.company_id
      AND companies.user_id = auth.uid()
    )
  );

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

-- Créer le bucket pour les documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Créer le bucket pour les logos (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket documents
CREATE POLICY "Users can upload documents to own companies"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id::text = (storage.foldername(name))[1]
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view documents of own companies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id::text = (storage.foldername(name))[1]
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete documents of own companies"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id::text = (storage.foldername(name))[1]
      AND companies.user_id = auth.uid()
    )
  );

-- Policies pour le bucket logos
CREATE POLICY "Users can upload logos to own companies"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos' AND
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id::text = (storage.foldername(name))[1]
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "Users can delete logos of own companies"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos' AND
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id::text = (storage.foldername(name))[1]
      AND companies.user_id = auth.uid()
    )
  );
