-- =====================================================
-- Acceptation des CGU / politique de confidentialité (Phase 3, lancement).
-- NULL = pas encore accepté → l'écran de fin d'onboarding affiche le consent gate.
-- =====================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN user_settings.terms_accepted_at IS
  'Acceptation CGU/confidentialité à la fin de l''onboarding. NULL = à valider.';
