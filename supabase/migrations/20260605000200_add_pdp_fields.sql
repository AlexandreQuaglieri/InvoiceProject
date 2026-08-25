-- =====================================================
-- Champs PDP (transmission B2B - facturation électronique 2026)
-- Référence de dépôt côté Plateforme Agréée (Super PDP) pour suivre le cycle de vie.
-- =====================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pdp_deposit_id TEXT,
  ADD COLUMN IF NOT EXISTS pdp_transmitted_at TIMESTAMPTZ;
