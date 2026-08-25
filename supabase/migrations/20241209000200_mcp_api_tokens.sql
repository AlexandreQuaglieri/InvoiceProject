-- Table pour stocker les tokens API MCP
CREATE TABLE IF NOT EXISTS mcp_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Index pour recherche rapide par hash
CREATE INDEX IF NOT EXISTS idx_mcp_api_tokens_hash ON mcp_api_tokens(token_hash);

-- Index pour recherche par user
CREATE INDEX IF NOT EXISTS idx_mcp_api_tokens_user ON mcp_api_tokens(user_id);

-- RLS pour que chaque user ne voit que ses tokens
ALTER TABLE mcp_api_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: les utilisateurs peuvent voir leurs propres tokens
CREATE POLICY "Users can view their own tokens" ON mcp_api_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: les utilisateurs peuvent créer leurs propres tokens
CREATE POLICY "Users can create their own tokens" ON mcp_api_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: les utilisateurs peuvent supprimer leurs propres tokens
CREATE POLICY "Users can delete their own tokens" ON mcp_api_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Policy: les utilisateurs peuvent mettre à jour leurs propres tokens (pour last_used_at)
CREATE POLICY "Users can update their own tokens" ON mcp_api_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Limite de 5 tokens par utilisateur (via trigger)
CREATE OR REPLACE FUNCTION check_token_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM mcp_api_tokens WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 API tokens per user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_token_limit ON mcp_api_tokens;
CREATE TRIGGER enforce_token_limit
  BEFORE INSERT ON mcp_api_tokens
  FOR EACH ROW
  EXECUTE FUNCTION check_token_limit();
