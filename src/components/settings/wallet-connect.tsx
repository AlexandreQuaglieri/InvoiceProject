'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Wallet, ExternalLink, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Data Wallet (Fluid Store) — connexion de l'identité utilisateur au wallet.
// La clé d'API (fsk_live_…) reste côté serveur (webhook) : ici on ne fait que rediriger
// vers le flux /connect du wallet (login Google -> liaison d'identité, pas de consentement en first-party).
const WALLET_URL = process.env.NEXT_PUBLIC_WALLET_URL || 'https://fluid-store-mcp.quaglieri-alexandre.workers.dev'
const WALLET_APP_ID = process.env.NEXT_PUBLIC_WALLET_APP_ID || 'facture-quatools-32cb35'
const WALLET_SCOPES = 'profile:read,ai_context:read,documents:read'

export function WalletConnect({ userId }: { userId: string }) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('wallet') === '1') {
      if (sp.get('status') === 'approved') {
        localStorage.setItem('wallet_connected', '1')
        toast.success('Wallet connecté ✅')
      } else {
        toast.error('Connexion au wallet annulée.')
      }
      window.history.replaceState({}, '', window.location.pathname)
    }
    setConnected(localStorage.getItem('wallet_connected') === '1')
  }, [])

  function connect() {
    if (!userId) {
      toast.error('Session introuvable, reconnecte-toi.')
      return
    }
    const owner = `${WALLET_APP_ID}:${userId}`
    const redirect = `${window.location.origin}/settings?wallet=1`
    window.location.href =
      `${WALLET_URL}/connect?app_id=${encodeURIComponent(WALLET_APP_ID)}` +
      `&member_owner_id=${encodeURIComponent(owner)}` +
      `&scopes=${encodeURIComponent(WALLET_SCOPES)}` +
      `&redirect_uri=${encodeURIComponent(redirect)}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" /> Mon Data Wallet
        </CardTitle>
        <CardDescription>
          Connecte tes données de facturation à ton wallet personnel : tu gardes le contrôle de tes
          données et tu peux les réutiliser (avec ton accord) dans tes autres apps Quatools.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Wallet connecté
            </span>
            <Button asChild>
              <a href={`${WALLET_URL}/me`} target="_blank" rel="noopener">
                Ouvrir mon wallet <ExternalLink className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" onClick={connect}>
              Reconfigurer
            </Button>
          </div>
        ) : (
          <Button onClick={connect}>
            <Wallet className="mr-2 h-4 w-4" /> Configurer mon wallet
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
