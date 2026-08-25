-- =====================================================
-- SECURITY FIXES - 2026-03-26
-- 1. RLS sur les tables MCP OAuth (ERROR)
-- 2. search_path fixé sur toutes les fonctions (WARN)
-- =====================================================

-- =====================================================
-- 1. RLS sur mcp_oauth_clients
-- Accès exclusivement via service_role (admin client)
-- qui bypass RLS de toute façon.
-- =====================================================
ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;

-- Aucune policy pour les roles anon/authenticated : deny all
-- Le service_role bypasse RLS et continue de fonctionner.

-- =====================================================
-- 2. RLS sur mcp_oauth_codes
-- Codes d'autorisation éphémères, server-side uniquement.
-- Supprimer les policies trop permissives si elles existent.
-- =====================================================
ALTER TABLE public.mcp_oauth_codes ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies héritées trop larges (WITH CHECK (true))
DROP POLICY IF EXISTS "System can insert codes" ON public.mcp_oauth_codes;
DROP POLICY IF EXISTS "System can delete codes" ON public.mcp_oauth_codes;

-- Seuls les utilisateurs peuvent voir leurs propres codes (lecture seule)
-- Les INSERT/DELETE/UPDATE passent exclusivement par le service_role
DROP POLICY IF EXISTS "Users can view their own codes" ON public.mcp_oauth_codes;
CREATE POLICY "Users can view their own codes" ON public.mcp_oauth_codes
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- 3. RLS sur mcp_oauth_tokens
-- Supprimer les policies trop permissives.
-- =====================================================
ALTER TABLE public.mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can insert tokens" ON public.mcp_oauth_tokens;
DROP POLICY IF EXISTS "System can update tokens" ON public.mcp_oauth_tokens;

-- Les utilisateurs peuvent voir et révoquer leurs propres tokens
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.mcp_oauth_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.mcp_oauth_tokens;

CREATE POLICY "Users can view their own tokens" ON public.mcp_oauth_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens" ON public.mcp_oauth_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 4. Fixer search_path sur toutes les fonctions
-- Prévient les attaques par search_path injection
-- =====================================================
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.calculate_invoice_item_totals() SET search_path = public;
ALTER FUNCTION public.recalculate_invoice_totals() SET search_path = public;
ALTER FUNCTION public.create_user_settings() SET search_path = public;
ALTER FUNCTION public.check_token_limit() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'cleanup_expired_oauth_data') THEN
    EXECUTE 'ALTER FUNCTION public.cleanup_expired_oauth_data() SET search_path = public';
  END IF;
END $$;
