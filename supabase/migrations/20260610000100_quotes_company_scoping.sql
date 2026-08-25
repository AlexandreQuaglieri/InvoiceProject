-- =====================================================
-- Scoping des devis par company_id (charte règle 5 : « tout en company_id »)
-- + policy UPDATE manquante sur documents.
--
-- La colonne quotes.company_id existe déjà (NOT NULL, renseignée à chaque
-- insert) : on migre uniquement l'unicité du numéro, les index et les
-- policies RLS pour s'aligner sur invoices/clients. user_id reste en
-- colonne (legacy) mais n'est plus la clé de scoping.
-- =====================================================

-- Unicité du numéro de devis par entreprise (et non plus par utilisateur)
DROP INDEX IF EXISTS idx_quotes_number_unique;
CREATE UNIQUE INDEX idx_quotes_number_unique ON quotes(company_id, quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);

-- =====================================================
-- RLS quotes : scoping via companies (pattern invoices)
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can create their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON quotes;

CREATE POLICY "Users can view quotes of own companies"
  ON quotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = quotes.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create quotes for own companies"
  ON quotes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = quotes.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update quotes of own companies"
  ON quotes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = quotes.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete quotes of own companies"
  ON quotes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = quotes.company_id
      AND companies.user_id = auth.uid()
    )
  );

-- =====================================================
-- RLS quote_items : via quotes → companies
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own quote items" ON quote_items;
DROP POLICY IF EXISTS "Users can create their own quote items" ON quote_items;
DROP POLICY IF EXISTS "Users can update their own quote items" ON quote_items;
DROP POLICY IF EXISTS "Users can delete their own quote items" ON quote_items;

CREATE POLICY "Users can view quote items of own companies"
  ON quote_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      JOIN companies ON companies.id = quotes.company_id
      WHERE quotes.id = quote_items.quote_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create quote items for own companies"
  ON quote_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      JOIN companies ON companies.id = quotes.company_id
      WHERE quotes.id = quote_items.quote_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update quote items of own companies"
  ON quote_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      JOIN companies ON companies.id = quotes.company_id
      WHERE quotes.id = quote_items.quote_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete quote items of own companies"
  ON quote_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      JOIN companies ON companies.id = quotes.company_id
      WHERE quotes.id = quote_items.quote_id
      AND companies.user_id = auth.uid()
    )
  );

-- =====================================================
-- documents : policy UPDATE manquante (SELECT/INSERT/DELETE existent)
-- =====================================================

CREATE POLICY "Users can update documents of own companies"
  ON documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = documents.company_id
      AND companies.user_id = auth.uid()
    )
  );
