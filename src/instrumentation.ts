// Hook exécuté une fois au démarrage du serveur (Next.js instrumentation).
// On y (re)déclare les événements de l'app auprès du hub de notification, pour
// ne JAMAIS avoir à passer par une URL/page de setup pour déclarer un event.
// AWAITÉ (pas fire-and-forget) : sur serverless, une promesse détachée peut
// être gelée avec l'instance avant d'aboutir — la déclaration n'arrivait
// jamais. Un fetch au cold start est un coût acceptable ; l'échec reste
// non bloquant (catch + log).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerAppEvents } = await import('@/lib/notifications/hub')
    await registerAppEvents().catch((e) =>
      console.error('[instrumentation] registerAppEvents', e)
    )
  }
}
