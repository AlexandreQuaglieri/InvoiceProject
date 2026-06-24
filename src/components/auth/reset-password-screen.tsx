'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { updatePassword } from '@/actions/auth'
import { MIN_PASSWORD_LENGTH, type AuthErrorCode } from '@/lib/validations/auth'

// `hasRecoverySession` est calculé côté serveur (page) : on n'affiche le
// formulaire que si une session de récupération est bien active.
export function ResetPasswordScreen({ hasRecoverySession }: { hasRecoverySession: boolean }) {
  const t = useTranslations()
  const router = useRouter()
  const [serverError, setServerError] = useState<AuthErrorCode | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const schema = z.object({
    password: z.string().min(MIN_PASSWORD_LENGTH, t('auth.fieldErrors.passwordMin')),
  })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '' } })

  const onSubmit = async (values: Values) => {
    setServerError(null)
    const res = await updatePassword({ password: values.password })
    if (!res.ok) {
      setServerError(res.error)
      return
    }
    router.push(res.redirect ?? '/dashboard')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted">
      <Card className="mx-4 w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t('auth.reset.title')}</CardTitle>
          <CardDescription>{t('auth.reset.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasRecoverySession ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden />
              <AlertDescription>
                {t('auth.reset.invalidLink')}{' '}
                <a href="/forgot-password" className="font-medium underline underline-offset-4">
                  {t('auth.forgot.title')}
                </a>
              </AlertDescription>
            </Alert>
          ) : (
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
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.reset.passwordLabel')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder={t('auth.passwordPlaceholder')}
                            className="pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center rounded-md px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      {t('common.loading')}
                    </span>
                  ) : (
                    t('auth.reset.cta')
                  )}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
