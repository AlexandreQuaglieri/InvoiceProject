// Hook exécuté une fois au démarrage du serveur (Next.js instrumentation).
// On y (re)déclare les événements de l'app auprès du hub de notification, pour
// ne JAMAIS avoir à passer par une URL/page de setup pour déclarer un event.
// Best-effort (fire-and-forget) : ne bloque pas le démarrage.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerAppEvents } = await import('@/lib/notifications/hub')
    void registerAppEvents().catch((e) => console.error('[instrumentation] registerAppEvents', e))
  }
}
