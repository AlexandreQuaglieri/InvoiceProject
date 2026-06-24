'use client'

import { useState, type ComponentType, type SVGProps } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { OAUTH_PROVIDERS, type OAuthProvider } from '@/lib/validations/auth'
import { GoogleIcon, AppleIcon, MicrosoftIcon, DiscordIcon } from './provider-icons'

type ProviderDef = { id: OAuthProvider; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }

const ALL_PROVIDERS: ProviderDef[] = [
  { id: 'google', label: 'Google', Icon: GoogleIcon },
  { id: 'apple', label: 'Apple', Icon: AppleIcon },
  { id: 'azure', label: 'Microsoft', Icon: MicrosoftIcon },
  { id: 'discord', label: 'Discord', Icon: DiscordIcon },
]

// Liste des providers affichés, pilotable via NEXT_PUBLIC_AUTH_PROVIDERS
// (ex. "google,apple"). Par défaut : tous. Permet de masquer un provider tant
// qu'il n'est pas configuré côté dashboard Supabase.
function enabledProviders(): ProviderDef[] {
  const raw = process.env.NEXT_PUBLIC_AUTH_PROVIDERS?.trim()
  if (!raw) return ALL_PROVIDERS
  const allow = new Set(raw.split(',').map((s) => s.trim()))
  const filtered = ALL_PROVIDERS.filter((p) => allow.has(p.id) && OAUTH_PROVIDERS.includes(p.id))
  return filtered.length > 0 ? filtered : ALL_PROVIDERS
}

export function OAuthButtons() {
  const t = useTranslations()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState<OAuthProvider | null>(null)
  const providers = enabledProviders()

  const signIn = async (provider: OAuthProvider) => {
    setPending(provider)
    const supabase = createClient()

    // Préserve les paramètres de flux (redirect MCP, destination demandée).
    const params = new URLSearchParams()
    const oauthRedirect = searchParams.get('oauth_redirect')
    const next = searchParams.get('next')
    if (oauthRedirect) params.set('oauth_redirect', oauthRedirect)
    if (next) params.set('next', next)
    const qs = params.toString()
    const redirectTo = `${window.location.origin}/auth/callback${qs ? `?${qs}` : ''}`

    const options: { redirectTo: string; scopes?: string } = { redirectTo }
    if (provider === 'azure') options.scopes = 'email'

    const { error } = await supabase.auth.signInWithOAuth({ provider, options })
    if (error) {
      console.error('[oauth]', provider, error.message)
      setPending(null)
    }
  }

  return (
    <div className="grid gap-2">
      {providers.map(({ id, label, Icon }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => signIn(id)}
          disabled={pending !== null}
        >
          {pending === id ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />}
          <span>{t('auth.continueWith', { provider: label })}</span>
        </Button>
      ))}
    </div>
  )
}
