-- Tables OAuth 2.1 pour MCP (Claude.ai)
-- Dynamic Client Registration, Authorization Codes, Tokens

-- =============================================
-- Table: mcp_oauth_clients (Dynamic Client Registration)
-- =============================================
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR(255) NOT NULL UNIQUE,
  client_secret_hash VARCHAR(255),
  client_name VARCHAR(255) NOT NULL DEFAULT 'MCP Client',
  redirect_uris TEXT[] NOT NULL,
  grant_types TEXT[] NOT NULL DEFAULT ARRAY['authorization_code'],
  response_types TEXT[] NOT NULL DEFAULT ARRAY['code'],
  token_endpoint_auth_method VARCHAR(50) NOT NULL DEFAULT 'none',
  application_type VARCHAR(50) NOT NULL DEFAULT 'web',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_clients_client_id ON mcp_oauth_clients(client_id);

-- =============================================
-- Table: mcp_oauth_codes (Authorization Codes)
-- =============================================
CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash VARCHAR(255) NOT NULL UNIQUE,
  client_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  scope VARCHAR(255) NOT NULL DEFAULT 'mcp',
  code_challenge VARCHAR(255) NOT NULL,
  code_challenge_method VARCHAR(10) NOT NULL DEFAULT 'S256',
  resource TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_hash ON mcp_oauth_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_expires ON mcp_oauth_codes(expires_at);

-- =============================================
-- Table: mcp_oauth_tokens (Access & Refresh Tokens)
-- =============================================
CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash VARCHAR(255) NOT NULL UNIQUE,
  refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
  client_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope VARCHAR(255) NOT NULL DEFAULT 'mcp',
  resource TEXT,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_access ON mcp_oauth_tokens(access_token_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_refresh ON mcp_oauth_tokens(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_user ON mcp_oauth_tokens(user_id);

-- =============================================
-- RLS Policies
-- =============================================

-- mcp_oauth_clients: Pas de RLS (géré par l'app)
-- Les clients sont créés par DCR, pas par les utilisateurs directement

-- mcp_oauth_codes: Les utilisateurs peuvent voir leurs propres codes
ALTER TABLE mcp_oauth_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own codes" ON mcp_oauth_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert codes" ON mcp_oauth_codes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can delete codes" ON mcp_oauth_codes
  FOR DELETE USING (true);

-- mcp_oauth_tokens: Les utilisateurs peuvent gérer leurs tokens
ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tokens" ON mcp_oauth_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert tokens" ON mcp_oauth_tokens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update tokens" ON mcp_oauth_tokens
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own tokens" ON mcp_oauth_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- Cleanup job: Supprimer les codes expirés (optionnel, peut être fait via cron)
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_data()
RETURNS void AS $$
BEGIN
  -- Supprimer les codes d'autorisation expirés
  DELETE FROM mcp_oauth_codes WHERE expires_at < NOW();

  -- Supprimer les tokens expirés (access ET refresh)
  DELETE FROM mcp_oauth_tokens
  WHERE refresh_token_expires_at < NOW();

  -- Supprimer les clients expirés
  DELETE FROM mcp_oauth_clients
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
