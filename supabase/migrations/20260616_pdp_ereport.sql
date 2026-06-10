-- =====================================================
-- E-reporting idempotent + encaissements (Phase 2, conformité 2026).
-- pdp_ereport_id : id de la transaction B2C déclarée (guard anti double-clic).
-- pdp_payment_* : déclaration de l'encaissement (B2C → b2c_payments,
-- B2B transmise → event fr:212 « Paiement reçu »).
-- =====================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pdp_ereport_id TEXT,
  ADD COLUMN IF NOT EXISTS pdp_ereported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdp_payment_report_id TEXT,
  ADD COLUMN IF NOT EXISTS pdp_payment_reported_at TIMESTAMPTZ;
