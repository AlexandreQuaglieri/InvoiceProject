'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertCircle, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { signInWithPassword, signUpWithPassword } from '@/actions/auth'
import { MIN_PASSWORD_LENGTH, type AuthErrorCode } from '@/lib/validations/auth'

type Mode = 'signin' | 'signup'

export function CredentialsForm({ mode }: { mode: Mode }) {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState<AuthErrorCode | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const schema = z.object({
    email: z.string().trim().email(t('auth.fieldErrors.email')),
    password: z.string().min(MIN_PASSWORD_LENGTH, t('auth.fieldErrors.passwordMin')),
  })
  type Values = z.infer<typeof schema>

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: Values) => {
    setServerError(null)
    const next = searchParams.get('next') ?? undefined
    const action = mode === 'signin' ? signInWithPassword : signUpWithPassword
    const res = await action({ email: values.email, password: values.password, next })
    if (!res.ok) {
      setServerError(res.error)
      return
    }
    if (res.needsConfirmation) {
      setSentTo(values.email)
      return
    }
    router.push(res.redirect ?? '/dashboard')
  }

  // Écran « vérifiez votre email » après inscription avec confirmation requise.
  if (sentTo) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
        <MailCheck className="mx-auto mb-2 h-8 w-8 text-primary" aria-hidden />
        <p className="font-medium">{t('auth.confirmTitle')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('auth.confirmBody', { email: sentTo })}
        </p>
      </div>
    )
  }

  const submitting = form.formState.isSubmitting

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {serverError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription>{t(`auth.errors.${serverError}`)}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.emailLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.passwordLabel')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="pr-10"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === 'signin' && (
          <div className="-mt-1 text-right">
            <a
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t('auth.forgotPassword')}
            </a>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('common.loading')}
            </span>
          ) : mode === 'signin' ? (
            t('auth.signInCta')
          ) : (
            t('auth.signUpCta')
          )}
        </Button>
      </form>
    </Form>
  )
}
