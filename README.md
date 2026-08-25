# Factur-IA

SaaS de **facturation française AI-first**, conçu pour la facturation électronique
obligatoire (2026). Trois façons de piloter sa facturation :

1. **Interface web** classique (dashboard, CRUD entreprise / clients / factures / devis)
2. **Assistant IA intégré** — créer/modifier en langage naturel (« Crée une facture de 500 € pour Client X »)
3. **Serveur MCP distant** — piloter sa facturation directement depuis Claude.ai / Claude Desktop

## Stack

| Couche        | Technologie |
|---------------|-------------|
| Framework     | Next.js 16 (App Router, RSC, Server Actions) · React 19 |
| UI            | Tailwind v4 · shadcn/ui (Radix) · next-themes · next-intl (FR/EN) |
| Données / Auth | Supabase (Postgres + RLS + Auth Google + Storage) |
| IA            | `@anthropic-ai/sdk` — chat function-calling + extraction vision (modèle `claude-sonnet-4-6`) |
| MCP           | `mcp-handler` · `@modelcontextprotocol/sdk` · OAuth 2.1 |
| E-invoicing   | Factur-X (XML CII EN16931 + PDF/A-3 via `pdf-lib`) · Chorus Pro / PISTE |
| PDF           | `@react-pdf/renderer` |
| Sync          | Data Wallet (Fluid Store) |

## Démarrage

```bash
npm install
npm run dev        # http://localhost:3000
```

Build de production :

```bash
npm run build
npm run start
```

## Variables d'environnement

À placer dans `.env.local` (jamais committé — voir `.gitignore`).

| Variable | Rôle |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role (serveur / MCP — **secrète**) |
| `ANTHROPIC_API_KEY` | Clé Claude plateforme (fallback si l'utilisateur n'a pas sa propre clé BYOK) |
| `NEXT_PUBLIC_APP_URL` | URL publique stable (OAuth MCP). **Ne jamais utiliser `VERCEL_URL`** — voir `src/lib/base-url.ts` |
| `CHORUS_PRO_CLIENT_ID` / `CHORUS_PRO_CLIENT_SECRET` | Identifiants PISTE (OAuth Chorus Pro) |
| `CHORUS_PRO_LOGIN` / `CHORUS_PRO_PASSWORD` | Compte technique Chorus Pro |
| `CHORUS_PRO_SANDBOX` | `true` = sandbox PISTE, `false` = production |
| `WALLET_URL` / `WALLET_APP_ID` / `WALLET_API_KEY` | Sync Data Wallet (optionnel) |

> ⚠️ Les clés `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` et les identifiants
> Chorus Pro sont des secrets serveur. Faites-les tourner avant tout partage du code
> ou passage en production publique.

## Base de données

Migrations SQL dans `supabase/migrations/` (à appliquer dans l'ordre via le SQL
Editor Supabase ou la CLI). Tables principales : `companies`, `clients`,
`invoices` + `invoice_items`, `quotes` + `quote_items`, `user_settings`,
`documents`, et les tables OAuth MCP (`mcp_oauth_*`, `mcp_api_tokens`). RLS activé
partout ; les totaux de facture sont recalculés par trigger côté base.

## Architecture (src/)

```
app/
  api/chat            Assistant IA in-app (function calling)
  api/extract-document Extraction IA Kbis/RIB (vision)
  api/invoices/[id]/pdf, .../transmit   PDF + transmission Chorus Pro
  mcp/[transport]     Serveur MCP (outils clients/factures/devis/entreprise)
  oauth/*, .well-known/*   Flux OAuth 2.1 du connecteur MCP
actions/              Server Actions (CRUD + wallet sync)
lib/
  facturx/            Génération XML CII + embarquement PDF/A-3 (Factur-X)
  chorus-pro/         Client PISTE / Chorus Pro
  pdf/                Templates PDF facture & devis
  supabase/           Clients SSR / admin / middleware
  validations/        Schémas Zod + numérotation
```

## Numérotation

- **Factures** : `YYYYMMDD-NN` (`generateInvoiceNumber`, compteur `user_settings.invoice_next_number`).
- **Devis** : `D-YYYY-NNN` — source de vérité unique partagée par l'app, le serveur MCP et l'assistant chat.

## Déploiement

Déployé sur Vercel (`https://facturation.quatools.fr`). Définir toutes les
variables d'environnement ci-dessus côté Vercel (prod + preview), en particulier
`NEXT_PUBLIC_APP_URL` pour un domaine OAuth MCP stable.

## Serveur MCP

Documentation de connexion détaillée : [`docs/MCP_SERVER_SETUP.md`](docs/MCP_SERVER_SETUP.md).
