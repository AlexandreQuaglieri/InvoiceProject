// RSC fin : le store live est seedé par le layout (dashboard). On lit seulement
// l'acceptation des CGU (non présente dans le store) et on délègue au gate
// client, qui dérive onboarding / complétion / dashboard du store live.
import { getUserSettings } from '@/actions/settings'
import { DashboardGate } from '@/components/onboarding/dashboard-gate'

export default async function DashboardPage() {
  const settings = await getUserSettings()
  return <DashboardGate termsAcceptedAt={settings?.terms_accepted_at ?? null} />
}
