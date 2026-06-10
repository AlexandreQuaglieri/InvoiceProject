import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { defaultLocale, locales, type Locale } from './config'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value as Locale | undefined

  const locale = localeCookie && locales.includes(localeCookie) ? localeCookie : defaultLocale

  // Messages éclatés par domaine (app = l'existant ; landing/onboarding/legal =
  // surfaces de commercialisation). Fusion plate : les namespaces ne se recouvrent pas.
  const [app, landing, onboarding, legal] = await Promise.all([
    import(`../messages/${locale}/app.json`),
    import(`../messages/${locale}/landing.json`),
    import(`../messages/${locale}/onboarding.json`),
    import(`../messages/${locale}/legal.json`),
  ])

  return {
    locale,
    messages: {
      ...app.default,
      ...landing.default,
      ...onboarding.default,
      ...legal.default,
    },
  }
})
