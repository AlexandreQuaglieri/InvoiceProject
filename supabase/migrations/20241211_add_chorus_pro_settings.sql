-- Ajout des paramètres Chorus Pro à user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS chorus_pro_client_id TEXT,
  ADD COLUMN IF NOT EXISTS chorus_pro_client_secret TEXT,
  ADD COLUMN IF NOT EXISTS chorus_pro_login TEXT,
  ADD COLUMN IF NOT EXISTS chorus_pro_password TEXT,
  ADD COLUMN IF NOT EXISTS chorus_pro_sandbox BOOLEAN NOT NULL DEFAULT TRUE;
