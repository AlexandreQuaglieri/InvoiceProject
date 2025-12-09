'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { signOut } from '@/actions/auth'
import { useState } from 'react'

export function LogoutButton() {
  const t = useTranslations()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    await signOut()
  }

  return (
    <Button variant="outline" onClick={handleLogout} disabled={isLoading}>
      {isLoading ? t('common.loading') : t('nav.logout')}
    </Button>
  )
}
