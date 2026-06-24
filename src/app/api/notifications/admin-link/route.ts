import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAdminLinkUrl } from '@/lib/notifications/hub'

// Outil d'association : génère le lien d'admin du hub et y redirige l'utilisateur
// connecté. Visiter (connecté au hub dans le même navigateur) :
//   GET /api/notifications/admin-link
// Réservé à NOTIFICATION_ADMIN_EMAIL si défini, sinon à tout utilisateur authentifié.
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const adminEmail = process.env.NOTIFICATION_ADMIN_EMAIL
  if (adminEmail && user.email !== adminEmail) {
    return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 })
  }

  const app = process.env.NOTIFICATION_APP
  const orgId = process.env.NOTIFICATION_ORG_ID
  if (!app || !orgId) {
    return NextResponse.json(
      {
        error:
          "Configuration manquante : posez NOTIFICATION_APP (identifiant de l'app) et NOTIFICATION_ORG_ID (UUID de l'org) — visibles dans l'Espace développeur du hub.",
      },
      { status: 503 }
    )
  }

  const url = buildAdminLinkUrl({
    app,
    orgId,
    appUserId: user.id,
    email: user.email ?? undefined,
  })
  if (!url) {
    return NextResponse.json(
      { error: 'NOTIFICATION_HUB_URL / NOTIFICATION_SIGNING_SECRET requis.' },
      { status: 503 }
    )
  }

  return NextResponse.redirect(url)
}
