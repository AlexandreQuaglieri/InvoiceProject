// Rate limiting persistant (Postgres) — partagé entre toutes les instances
// Vercel, survit aux redéploiements. La décision est prise par la fonction SQL
// check_rate_limit (atomique, fenêtre fixe), appelée avec le client admin.
import { createAdminClient } from '@/lib/supabase/admin'

export type RateLimitOptions = {
  max: number
  windowSeconds: number
}

// true = requête autorisée, false = limite atteinte.
// Fail-open : si la RPC échoue (DB indisponible), on laisse passer en loggant —
// une panne de base ne doit pas bloquer la facturation, et l'appel métier
// suivant échouera de toute façon si la DB est réellement down.
export async function rateLimit(
  scope: string,
  id: string,
  { max, windowSeconds }: RateLimitOptions
): Promise<boolean> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: `${scope}:${id}`,
      p_max: max,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      console.error('[rate-limit] RPC check_rate_limit en échec', { scope }, error)
      return true
    }
    return data === true
  } catch (e) {
    console.error('[rate-limit] appel rate limit en échec', { scope }, e)
    return true
  }
}

// Adresse IP du client derrière le proxy Vercel (pour les endpoints publics).
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
