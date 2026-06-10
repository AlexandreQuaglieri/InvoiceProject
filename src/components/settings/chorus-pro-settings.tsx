'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { updateChorusProSettings } from '@/actions/settings'
import { Eye, EyeOff } from 'lucide-react'

const schema = z.object({
  chorus_pro_client_id: z.string().min(1, 'Requis'),
  // Optionnels : vides = secrets existants inchangés (jamais renvoyés au client).
  chorus_pro_client_secret: z.string(),
  chorus_pro_login: z.string().min(1, 'Requis'),
  chorus_pro_password: z.string(),
  chorus_pro_sandbox: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface ChorusProSettingsProps {
  // Les secrets ne quittent JAMAIS le serveur : seuls les identifiants non
  // sensibles et un indicateur de configuration arrivent ici.
  initialValues: {
    chorus_pro_client_id?: string | null
    chorus_pro_login?: string | null
    chorus_pro_sandbox?: boolean | null
  }
  configured: boolean
}

export function ChorusProSettings({ initialValues, configured }: ChorusProSettingsProps) {
  const [showSecret, setShowSecret] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      chorus_pro_client_id: initialValues.chorus_pro_client_id ?? '',
      chorus_pro_client_secret: '',
      chorus_pro_login: initialValues.chorus_pro_login ?? '',
      chorus_pro_password: '',
      chorus_pro_sandbox: initialValues.chorus_pro_sandbox ?? true,
    },
  })

  const sandbox = watch('chorus_pro_sandbox')

  const onSubmit = async (values: FormValues) => {
    // À la première configuration, les secrets sont obligatoires.
    if (!configured && (!values.chorus_pro_client_secret || !values.chorus_pro_password)) {
      toast.error('Le client secret et le mot de passe technique sont requis.')
      return
    }

    const result = await updateChorusProSettings({
      chorus_pro_client_id: values.chorus_pro_client_id,
      chorus_pro_login: values.chorus_pro_login,
      chorus_pro_sandbox: values.chorus_pro_sandbox,
      // Champ vide = on ne touche pas au secret existant.
      chorus_pro_client_secret: values.chorus_pro_client_secret || undefined,
      chorus_pro_password: values.chorus_pro_password || undefined,
    })
    if (result.success) {
      toast.success('Paramètres Chorus Pro sauvegardés')
      setValue('chorus_pro_client_secret', '')
      setValue('chorus_pro_password', '')
    } else {
      toast.error(result.error ?? 'Erreur lors de la sauvegarde')
    }
  }

  const secretPlaceholder = configured ? '•••••••• (configuré — laisser vide pour conserver)' : '••••••••••••'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chorus Pro / PISTE</CardTitle>
        <CardDescription>
          Connexion à la plateforme Chorus Pro pour la transmission électronique des factures (e-invoicing 2026).
          Créez votre application sur{' '}
          <a href="https://piste.gouv.fr" target="_blank" rel="noopener noreferrer" className="underline">
            piste.gouv.fr
          </a>{' '}
          pour obtenir vos identifiants.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Environnement */}
          <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/40">
            <input
              type="checkbox"
              id="sandbox"
              checked={sandbox}
              onChange={(e) => setValue('chorus_pro_sandbox', e.target.checked)}
              className="h-4 w-4"
            />
            <div>
              <Label htmlFor="sandbox" className="cursor-pointer font-medium">Mode sandbox (test)</Label>
              <p className="text-xs text-muted-foreground">
                Décochez uniquement quand vous êtes prêt pour la production.
              </p>
            </div>
          </div>

          {/* Client ID */}
          <div className="space-y-1">
            <Label htmlFor="client_id">Client ID PISTE</Label>
            <Input
              id="client_id"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              {...register('chorus_pro_client_id')}
            />
            {errors.chorus_pro_client_id && (
              <p className="text-xs text-destructive">{errors.chorus_pro_client_id.message}</p>
            )}
          </div>

          {/* Client Secret */}
          <div className="space-y-1">
            <Label htmlFor="client_secret">Client Secret PISTE</Label>
            <div className="relative">
              <Input
                id="client_secret"
                type={showSecret ? 'text' : 'password'}
                placeholder={secretPlaceholder}
                autoComplete="new-password"
                {...register('chorus_pro_client_secret')}
              />
              <button
                type="button"
                className="absolute right-2 top-2.5 text-muted-foreground"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.chorus_pro_client_secret && (
              <p className="text-xs text-destructive">{errors.chorus_pro_client_secret.message}</p>
            )}
          </div>

          {/* Login technique */}
          <div className="space-y-1">
            <Label htmlFor="login">Identifiant technique Chorus Pro</Label>
            <Input
              id="login"
              placeholder="TECH_1_xxxxx@cpro.fr"
              {...register('chorus_pro_login')}
            />
            <p className="text-xs text-muted-foreground">
              Format : TECH_1_xxxxx@cpro.fr (visible dans votre espace Chorus Pro → Raccordements)
            </p>
            {errors.chorus_pro_login && (
              <p className="text-xs text-destructive">{errors.chorus_pro_login.message}</p>
            )}
          </div>

          {/* Mot de passe technique */}
          <div className="space-y-1">
            <Label htmlFor="password">Mot de passe technique</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={secretPlaceholder}
                autoComplete="new-password"
                {...register('chorus_pro_password')}
              />
              <button
                type="button"
                className="absolute right-2 top-2.5 text-muted-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.chorus_pro_password && (
              <p className="text-xs text-destructive">{errors.chorus_pro_password.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
