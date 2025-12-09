import { createClient } from '@supabase/supabase-js'

// Client admin avec service role key - à utiliser uniquement côté serveur
// pour les opérations nécessitant des privilèges élevés
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
