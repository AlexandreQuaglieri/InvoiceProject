-- =====================================================
-- Raccordement PDP par utilisateur (multi-tenant, OAuth Authorization Code)
-- Chaque utilisateur délègue l'accès à SA société Super PDP. Jetons stockés ici
-- (protégés par la RLS existante de user_settings : chaque user ne voit que sa ligne).
-- =====================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS pdp_access_token TEXT,
  ADD COLUMN IF NOT EXISTS pdp_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS pdp_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdp_company_number TEXT,
  ADD COLUMN IF NOT EXISTS pdp_company_name TEXT,
  ADD COLUMN IF NOT EXISTS pdp_env TEXT,
  ADD COLUMN IF NOT EXISTS pdp_connected_at TIMESTAMPTZ;
