import { z } from 'zod'

// Schémas Zod partagés client/serveur (charte règle 3 : toujours revalidés côté
// serveur). Les messages d'erreur de champ sont fournis côté client via next-intl
// au moment du resolver ; côté serveur on ne renvoie qu'un code d'erreur stable.

export const MIN_PASSWORD_LENGTH = 8

export const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
})

export const emailOnlySchema = z.object({
  email: z.string().trim().email(),
})

export const updatePasswordSchema = z.object({
  password: z.string().min(MIN_PASSWORD_LENGTH),
})

export type Credentials = z.infer<typeof credentialsSchema>

// Codes d'erreur d'authentification — mappés vers des libellés i18n côté client
// (auth.errors.*). On ne renvoie jamais le message brut du provider.
export type AuthErrorCode =
  | 'invalid_input'
  | 'invalid_credentials'
  | 'email_exists'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'weak_password'
  | 'generic'

// Résultat uniforme des server actions d'auth.
export type AuthResult =
  | { ok: true; redirect?: string; needsConfirmation?: boolean }
  | { ok: false; error: AuthErrorCode }

// Providers OAuth proposés à l'utilisateur final. 'azure' = Microsoft côté Supabase.
export const OAUTH_PROVIDERS = ['google', 'azure', 'discord'] as const
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]
