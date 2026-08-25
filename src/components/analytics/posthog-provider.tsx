'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

// PostHog — mesure d'audience (instance EU, la même que quatools.fr).
// Ne fait rien si NEXT_PUBLIC_POSTHOG_KEY est absente (dev local, self-host).
// Visiteurs anonymes par défaut, Do Not Track respecté, saisies jamais captées :
// cohérent avec le positionnement « vos données restent en France ».
export function PostHogAnalytics() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key || posthog.__loaded) return
    posthog.init(key, {
      api_host: 'https://eu.i.posthog.com',
      ui_host: 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      respect_dnt: true,
      // 'history_change' : les navigations App Router comptent comme pageviews.
      capture_pageview: 'history_change',
      autocapture: true,
      disable_session_recording: true,
    })
  }, [])

  return null
}
