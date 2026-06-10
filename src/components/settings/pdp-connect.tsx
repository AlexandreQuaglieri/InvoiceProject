'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Plug, Loader2 } from 'lucide-react'
import type { PdpConnection } from '@/lib/pdp'

export function PdpConnect({ connection: initialConnection }: { connection: PdpConnection }) {
  const router = useRouter()
  const [connection, setConnection] = useState(initialConnection)
  const [disconnecting, setDisconnecting] = useState(false)

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/pdp/disconnect', { method: 'POST' })
      if (res.ok) {
        // Résultat connu : mise à jour locale immédiate, puis refresh serveur
        // (dernier recours légitime : l'état PDP vit dans user_settings, hors store live).
        setConnection({ connected: false })
        router.refresh()
        setDisconnecting(false)
        return
      }
    } catch (error) {
      console.error('Déconnexion de la PDP échouée', error)
    }
    setDisconnecting(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturation électronique (PDP)</CardTitle>
        <CardDescription>
          Raccordez votre société à la plateforme agréée Super PDP pour émettre, recevoir et déclarer
          vos factures électroniques (réforme 2026). Le raccordement passe par une vérification
          d&apos;identité (une seule fois), puis tout est automatique.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connection.connected ? (
          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">
                  Connecté{connection.companyName ? ` — ${connection.companyName}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connection.env === 'sandbox'
                    ? 'Environnement de test (sandbox)'
                    : 'Société raccordée à la PDP'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/api/pdp/connect">Reconnecter</a>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Déconnecter'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vous serez redirigé vers Super PDP pour connecter le compte de votre société, puis
              ramené ici automatiquement.
            </p>
            <Button asChild>
              <a href="/api/pdp/connect">
                <Plug className="mr-2 h-4 w-4" />
                Activer la facturation électronique
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
