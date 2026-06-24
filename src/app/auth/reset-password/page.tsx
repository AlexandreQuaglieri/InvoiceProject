import { createClient } from '@/lib/supabase/server'
import { ResetPasswordScreen } from '@/components/auth/reset-password-screen'

// La session de récupération est posée par /auth/callback à l'arrivée du lien
// email. On vérifie sa présence côté serveur pour n'afficher le formulaire que
// si l'utilisateur est bien en flux de réinitialisation.
export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <ResetPasswordScreen hasRecoverySession={user !== null} />
}
