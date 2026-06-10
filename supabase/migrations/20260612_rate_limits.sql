-- =====================================================
-- Rate limiting persistant (remplace la Map mémoire, cassée en
-- multi-instance Vercel). Fenêtre fixe, un seul statement atomique :
-- pas de race entre instances.
-- =====================================================

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL
);

-- Aucune policy : table accessible uniquement via service_role (le helper
-- src/lib/rate-limit.ts passe par le client admin).
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION check_rate_limit(p_key TEXT, p_max INT, p_window_seconds INT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO rate_limits AS rl (key, window_start, count)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN rl.window_start < now() - make_interval(secs => p_window_seconds)
                 THEN 1 ELSE rl.count + 1 END,
    window_start = CASE WHEN rl.window_start < now() - make_interval(secs => p_window_seconds)
                        THEN now() ELSE rl.window_start END
  RETURNING count <= p_max;
$$;

REVOKE EXECUTE ON FUNCTION check_rate_limit(TEXT, INT, INT) FROM anon, authenticated;

-- Nettoyage opportuniste : purge les fenêtres de plus de 24 h (volume borné
-- de toute façon à 1 ligne par scope:user, mais évite l'accumulation de
-- comptes/IP one-shot).
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rate_limits WHERE window_start < now() - interval '24 hours';
$$;

REVOKE EXECUTE ON FUNCTION cleanup_rate_limits() FROM anon, authenticated;
