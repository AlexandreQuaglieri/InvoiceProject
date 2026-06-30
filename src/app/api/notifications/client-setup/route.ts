import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureCompanyOrgId } from '@/lib/notifications/events'
import { buildAdminLinkUrl } from '@/lib/notifications/hub'

// Niveau 2 (marque blanche) : permet au propriétaire d'une entreprise d'administrer
// SON espace de notifications (org propre) — crée/récupère son org puis génère le
// lien d'association admin pour qu'il configure le mail envoyé à SES clients et son
// identité d'envoi.
//   GET /api/notifications/client-setup   (connecté à Factur-IA et au hub)
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: comp } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', user.id)
    .maybeSingle()
  const company = comp as { id: string; name: string } | null
  if (!company) {
    return NextResponse.json(
      { error: 'Aucune entreprise configurée. Complétez votre fiche entreprise.' },
      { status: 400 }
    )
  }

  const orgId = await ensureCompanyOrgId(supabase, company.id)
  if (!orgId) {
    return NextResponse.json(
      { error: 'Service de notifications indisponible. Réessayez plus tard.' },
      { status: 503 }
    )
  }

  const app = process.env.NOTIFICATION_APP
  const adminLink = app
    ? buildAdminLinkUrl({ app, orgId, appUserId: user.id, email: user.email ?? undefined })
    : null

  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
  const action = adminLink
    ? `<p style="margin-top:24px"><a href="${esc(adminLink)}" style="display:inline-block;background:#111;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Configurer mes notifications clients →</a></p>
<p style="color:#666;font-size:14px;margin-top:16px">Vous administrerez l'espace de notifications de <b>${esc(company.name)}</b>. Connectez-vous d'abord au hub (<a href="https://hub.quatools.fr">hub.quatools.fr</a>) dans cet onglet. Lien valable 2&nbsp;min : rechargez si besoin.</p>`
    : `<p style="margin-top:24px;padding:14px 16px;border:1px dashed #bbb;border-radius:8px;background:#fafafa">Configuration indisponible pour le moment.</p>`

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notifications à vos clients</title></head>
<body style="font-family:system-ui,sans-serif;max-width:660px;margin:48px auto;padding:0 16px;line-height:1.6;color:#111">
<h1 style="font-size:22px">Prévenir vos clients</h1>
<p>Configurez l'email envoyé à vos clients, à votre nom, quand vous leur adressez une facture ou un devis : objet, message et votre identité d'envoi (marque blanche).</p>
${action}
</body></html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
