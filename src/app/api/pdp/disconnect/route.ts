import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Déconnecte la société de la PDP : efface les jetons OAuth → on repart d'un compte
// non activé (utile pour basculer sandbox → production).
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  await supabase
    .from('user_settings')
    .update({
      pdp_access_token: null,
      pdp_refresh_token: null,
      pdp_token_expires_at: null,
      pdp_company_number: null,
      pdp_company_name: null,
      pdp_env: null,
      pdp_connected_at: null,
    })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
