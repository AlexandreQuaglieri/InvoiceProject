# Factur-IA

**La facturation qui s'écrit toute seule.** SaaS de facturation française AI-first,
open source, conçu pour la réforme de la facturation électronique (2026-2027) :
Factur-X, transmission PDP, réception des factures fournisseurs, e-reporting.

- 🌐 **Version hébergée (gratuite)** : [facturation.quatools.fr](https://facturation.quatools.fr)
- 🏠 **Self-host** : installez-la chez vous, guide ci-dessous
- 🔍 **Code auditable** : licence AGPL-3.0, aucune boîte noire

Trois façons de piloter sa facturation :

1. **Interface web** classique (dashboard, entreprise / clients / factures / devis)
2. **Assistant intégré** : créer/modifier en langage naturel (« Crée une facture de 500 € pour Client X »)
3. **Serveur MCP distant** : piloter sa facturation depuis Claude.ai, Claude Desktop ou ChatGPT

## Fonctionnalités

- **Factures & devis conformes** : Factur-X (XML CII EN 16931 embarqué dans un PDF/A-3), numérotation légale, conversion devis → facture
- **Facturation électronique 2026** : raccordement OAuth à une PDP partenaire, transmission, cycle de vie AFNOR complet (déposée → acceptée/refusée → encaissée), redépôt après rejet
- **Réception fournisseurs** : inbox des factures électroniques entrantes (obligation universelle depuis sept. 2026)
- **E-reporting B2C** et encaissements
- **Secteur public** : transmission Chorus Pro (PISTE)
- **IA** : extraction de Kbis/RIB/devis par vision, assistant conversationnel avec function calling, recherche d'entreprise (INSEE + web)
- **MCP** : 15 outils exposés via OAuth 2.1 (clients, factures, devis, stats…)
- **Temps réel** : UI optimiste + Supabase Realtime, zéro rechargement de page
- **FR/EN, dark mode, RGPD** : données hébergées en Europe, export à tout moment

## Stack

| Couche        | Technologie |
|---------------|-------------|
| Framework     | Next.js 16 (App Router, RSC, Server Actions) · React 19 · TypeScript strict |
| UI            | Tailwind v4 · shadcn/ui (Radix) · next-themes · next-intl (FR/EN) |
| Données / Auth | Supabase (Postgres + RLS + Auth + Storage + Realtime) |
| IA            | `@anthropic-ai/sdk` : chat function-calling + extraction vision |
| MCP           | `mcp-handler` · `@modelcontextprotocol/sdk` · OAuth 2.1 |
| E-invoicing   | Factur-X (XML CII EN 16931 + PDF/A-3 via `pdf-lib`) · PDP · Chorus Pro / PISTE |
| PDF           | `@react-pdf/renderer` |

## Installation (self-host)

### 1. Prérequis

- Node.js 20+
- Un projet [Supabase](https://supabase.com) (offre gratuite suffisante), ou une stack Supabase auto-hébergée
- Une clé API [Anthropic](https://console.anthropic.com) pour les fonctionnalités IA (optionnel : chaque utilisateur peut fournir la sienne dans les réglages)

### 2. Base de données

Avec la CLI Supabase :

```bash
npx supabase link --project-ref <votre-project-ref>
npx supabase db push          # applique supabase/migrations/ dans l'ordre
```

(ou copiez-collez les fichiers de `supabase/migrations/` dans l'ordre via le SQL Editor).

Puis, dans le dashboard Supabase :
- **Auth → Providers** : activez Email et les providers OAuth souhaités (Google, Azure, Discord…)
- **Auth → URL Configuration** : ajoutez `https://votre-domaine/**` aux redirect URLs
- Le bucket Storage `logos` et la publication Realtime sont créés par les migrations

### 3. Configuration

```bash
cp .env.example .env.local    # puis remplissez les valeurs
```

Le fichier [`.env.example`](.env.example) documente toutes les variables, avec leur
caractère requis ou optionnel. L'essentiel :

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` : **requis**
- `NEXT_PUBLIC_APP_URL` : **requis en production** (source de vérité OAuth/MCP)
- `APP_ENCRYPTION_KEY` : requis dès qu'un utilisateur enregistre un secret (`openssl rand -base64 32`)
- `LEGAL_*` : identité légale affichée sur les pages mentions légales / CGU / confidentialité
- PDP, Chorus Pro, hub de notifications, Data Wallet sont **optionnels** : chaque
  intégration se désactive proprement si ses variables sont absentes

### 4. Lancer

```bash
npm install
npm run dev        # http://localhost:3000
```

Build de production : `npm run build && npm run start`, ou déployez sur Vercel
(le cron de synchronisation PDP dans `vercel.json` nécessite `CRON_SECRET`).

## Architecture (src/)

```
app/
  (marketing)/        Landing + pages légales (publiques)
  (dashboard)/        Application (factures, devis, clients, inbox, e-reporting…)
  api/chat            Assistant IA in-app (function calling)
  api/extract-document Extraction IA Kbis/RIB (vision)
  api/invoices/[id]/  PDF, transmission PDP & Chorus Pro, e-reporting
  api/cron/pdp-sync   Synchronisation planifiée des statuts PDP
  mcp/[transport]     Serveur MCP (outils clients/factures/devis/entreprise)
  oauth/*, .well-known/*   Flux OAuth 2.1 du connecteur MCP
actions/              Server Actions (auth → Zod → service → revalidate)
lib/
  services/           Couche métier : SEULE porte d'écriture vers la base
  facturx/            Génération XML CII + embarquement PDF/A-3 (Factur-X)
  pdp/                Abstraction PdpProvider + implémentation partenaire
  chorus-pro/         Client PISTE / Chorus Pro
  realtime/           Providers + hooks live (Supabase Realtime)
  pdf/                Templates PDF facture & devis
  validations/        Schémas Zod + numérotation
```

Les règles d'architecture détaillées (source de vérité unique, Realtime +
optimistic, frontières de couches, Definition of Done) sont dans
[`CLAUDE.md`](CLAUDE.md), à lire avant de contribuer, voir aussi
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Numérotation

- **Factures** : `YYYYMMDD-NN` (`generateInvoiceNumber`, compteur `user_settings.invoice_next_number`)
- **Devis** : `D-YYYY-NNN`, source de vérité unique partagée par l'app, le serveur MCP et l'assistant

## Serveur MCP

Connectez votre facturation à Claude.ai ou ChatGPT avec l'URL
`https://votre-domaine/mcp` (OAuth 2.1, enregistrement dynamique).
Documentation détaillée : [`docs/MCP_SERVER_SETUP.md`](docs/MCP_SERVER_SETUP.md).

## Sécurité

Voir [`SECURITY.md`](SECURITY.md) pour signaler une vulnérabilité.

## Licence

[AGPL-3.0](LICENSE). Le code est libre : utilisez-le, auditez-le, hébergez-le.
Si vous exploitez une version modifiée en réseau, vous devez en publier les
sources. Les marques Factur-IA et Quatools ainsi que les contenus éditoriaux du
site ne sont pas couverts par la licence.
