import { Suspense } from 'react'
import { AuthScreen } from '@/components/auth/auth-screen'

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">…</div>
      }
    >
      <AuthScreen mode="signup" />
    </Suspense>
  )
}
