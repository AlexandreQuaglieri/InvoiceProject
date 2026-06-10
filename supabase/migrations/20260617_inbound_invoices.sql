-- =====================================================
-- Réception e-invoicing durcie (Phase 2, conformité 2026).
-- Les factures entrantes (PDP, direction=in) sont persistées localement :
-- consultation hors-ligne de la PDP, workflow acheteur (approuver / refuser =
-- statuts du cycle de vie), Realtime + optimistic côté UI.
-- local_status = décision de l'acheteur (état NON dérivable, conforme charte).
-- =====================================================

CREATE TABLE inbound_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  deposit_id TEXT NOT NULL,
  external_id TEXT,
  number TEXT,
  seller_name TEXT,
  seller_vat TEXT,
  total_with_vat NUMERIC(12,2),
  currency TEXT,
  issue_date DATE,
  received_at TIMESTAMPTZ NOT NULL,
  pdp_status TEXT,
  local_status TEXT NOT NULL DEFAULT 'new'
    CHECK (local_status IN ('new', 'approved', 'refused')),
  refusal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, deposit_id) -- clé d'upsert du sync
);

CREATE INDEX idx_inbound_invoices_company ON inbound_invoices(company_id);

ALTER TABLE inbound_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inbound invoices of own companies"
  ON inbound_invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = inbound_invoices.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage inbound invoices of own companies"
  ON inbound_invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = inbound_invoices.company_id
      AND companies.user_id = auth.uid()
    )
  );

-- Trigger updated_at (fonction définie par le schéma initial)
CREATE TRIGGER update_inbound_invoices_updated_at
  BEFORE UPDATE ON inbound_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Realtime (UI live) — REPLICA IDENTITY FULL pour que les events portent company_id.
ALTER TABLE inbound_invoices REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE inbound_invoices;
