import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function Home() {
  const t = useTranslations()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">{t('common.appName')}</CardTitle>
          <CardDescription className="text-lg">{t('auth.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full" size="lg">
            <Link href="/login">{t('auth.loginWithGoogle')}</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.welcome')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
