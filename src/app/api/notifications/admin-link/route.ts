import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureOrg, registerSupportEvents, buildAdminLinkUrl } from '@/lib/notifications/hub'

// Outil de configuration (une fois, connecté au hub) :
//   GET /api/notifications/admin-link?app=<identifiant-de-ton-app>
// → crée/récupère l'org (idempotent), déclare l'événement, et — si `app` est
//   fourni (query ou NOTIFICATION_APP) — affiche un bouton « Devenir admin ».
// Réservé à NOTIFICATION_ADMIN_EMAIL si défini.
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

  const orgId = await ensureOrg()
  if (!orgId) {
    return NextResponse.json(
      { error: 'Org introuvable. Vérifiez NOTIFICATION_HUB_URL et NOTIFICATION_API_KEY sur Vercel.' },
      { status: 503 }
    )
  }

  const app = new URL(request.url).searchParams.get('app')?.trim() || process.env.NOTIFICATION_APP

  const esc = (s: string) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string
    )

  let eventsLine: string
  if (app) {
    const events = await registerSupportEvents(app)
    eventsLine = events.ok
      ? `✅ Événement déclaré <code>${esc(events.body)}</code>`
      : `⚠️ Événement non déclaré (HTTP ${esc(String(events.status))}) : <code>${esc(events.body)}</code>`
  } else {
    eventsLine = `ℹ️ Ajoute <code>?app=…</code> ci-dessous pour déclarer l'événement.`
  }

  const adminLink = app
    ? buildAdminLinkUrl({ app, orgId, appUserId: user.id, email: user.email ?? undefined })
    : null
  const action = adminLink
    ? `<p style="margin-top:24px"><a href="${esc(adminLink)}" style="display:inline-block;background:#111;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Devenir admin de l'organisation →</a></p>
<p style="color:#666;font-size:14px;margin-top:16px">Connecte-toi d'abord au hub (<a href="https://hub.quatools.fr">hub.quatools.fr</a>) dans cet onglet, puis clique. Lien valable 2&nbsp;min : recharge si besoin.</p>`
    : `<p style="margin-top:24px;padding:14px 16px;border:1px dashed #bbb;border-radius:8px;background:#fafafa">Pour générer le lien admin, recharge cette page en ajoutant ton <b>identifiant d'app</b> :<br><code>?app=TON_IDENTIFIANT</code><br><span style="color:#666;font-size:14px">(l'identifiant que tu as donné à l'app dans l'Espace développeur — ce n'est pas un secret)</span></p>`

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configuration des notifications</title></head>
<body style="font-family:system-ui,sans-serif;max-width:660px;margin:48px auto;padding:0 16px;line-height:1.6;color:#111">
<h1 style="font-size:22px">Configuration des notifications</h1>
<p>✅ Organisation : <code>${esc(orgId)}</code></p>
<p>${eventsLine}</p>
${action}
</body></html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
