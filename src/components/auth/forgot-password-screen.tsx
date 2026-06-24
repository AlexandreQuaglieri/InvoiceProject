'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { requestPasswordReset } from '@/actions/auth'

export function ForgotPasswordScreen() {
  const t = useTranslations()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const schema = z.object({ email: z.string().trim().email(t('auth.fieldErrors.email')) })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = async (values: Values) => {
    setError(false)
    const res = await requestPasswordReset({ email: values.email })
    if (!res.ok) {
      setError(true)
      return
    }
    setSentTo(values.email)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted">
      <Link
        href="/login"
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('auth.forgot.backToLogin')}
      </Link>

      <Card className="mx-4 w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t('auth.forgot.title')}</CardTitle>
          <CardDescription>{t('auth.forgot.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sentTo ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
              <MailCheck className="mx-auto mb-2 h-8 w-8 text-primary" aria-hidden />
              <p className="font-medium">{t('auth.forgot.sentTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('auth.forgot.sentBody', { email: sentTo })}
              </p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden />
                    <AlertDescription>{t('auth.errors.generic')}</AlertDescription>
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
                <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      {t('common.loading')}
                    </span>
                  ) : (
                    t('auth.forgot.cta')
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
