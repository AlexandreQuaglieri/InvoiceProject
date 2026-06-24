'use client'

import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { OAuthButtons } from './oauth-buttons'
import { CredentialsForm } from './credentials-form'

type Mode = 'signin' | 'signup'

// Écran de connexion / inscription. Compose : OAuth (Supabase) + email/mot de
// passe (server actions Supabase). Préserve les paramètres de flux (oauth_redirect
// MCP, next) dans les liens internes.
export function AuthScreen({ mode }: { mode: Mode }) {
  const t = useTranslations()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const errorDesc = searchParams.get('desc')

  const passthrough = new URLSearchParams()
  const oauthRedirect = searchParams.get('oauth_redirect')
  const next = searchParams.get('next')
  if (oauthRedirect) passthrough.set('oauth_redirect', oauthRedirect)
  if (next) passthrough.set('next', next)
  const qs = passthrough.toString()
  const altHref = `${mode === 'signin' ? '/signup' : '/login'}${qs ? `?${qs}` : ''}`

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted">
      <Link
        href="/"
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('auth.backToSite')}
      </Link>

      <Card className="mx-4 w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {t(mode === 'signin' ? 'auth.loginTitle' : 'auth.signupTitle')}
          </CardTitle>
          <CardDescription>
            {t(mode === 'signin' ? 'auth.loginSubtitle' : 'auth.signupSubtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden />
              <AlertDescription>
                <div className="font-medium">{t('auth.providerError')}</div>
                <div className="mt-1 break-all text-xs opacity-80">{decodeURIComponent(error)}</div>
                {errorDesc && (
                  <div className="mt-1 text-xs opacity-60">{decodeURIComponent(errorDesc)}</div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <OAuthButtons />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('auth.orSeparator')}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <CredentialsForm mode={mode} />

          <p className="text-center text-sm text-muted-foreground">
            {t(mode === 'signin' ? 'auth.noAccount' : 'auth.haveAccount')}{' '}
            <Link href={altHref} className="font-medium text-foreground underline-offset-4 hover:underline">
              {t(mode === 'signin' ? 'auth.signUpLink' : 'auth.signInLink')}
            </Link>
          </p>

          <p className="text-center text-xs text-muted-foreground">
            {t('auth.termsNotice')}{' '}
            <Link href="/legal/cgu" className="underline hover:text-foreground">
              {t('auth.termsCgu')}
            </Link>{' '}
            {t('auth.termsAnd')}{' '}
            <Link href="/legal/confidentialite" className="underline hover:text-foreground">
              {t('auth.termsPrivacy')}
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
