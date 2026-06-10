# Factur-IA — Charte technique

SaaS de facturation française **AI-first**, argument central : **conformité facturation
électronique 2026** (Factur-X, PDP/Super PDP, e-reporting). Stack : **Next.js 16 (App Router,
RSC) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui · Supabase (Postgres + RLS +
Realtime) · Anthropic SDK**.

Ce document est un **contrat**, pas une suggestion. Toute contribution (humaine ou agent) le
respecte. En cas de doute, on relit ces règles avant d'écrire du code.

---

## Les 6 règles

### 1. Source de vérité unique
- **La DB Postgres est la vérité.** La couche `src/lib/services/` est la **SEULE porte
  d'écriture** : chat (`api/chat`), MCP (`mcp/[transport]`) et server actions y passent tous.
  Jamais de SQL ni de règle métier ailleurs.
- **État dérivé, jamais dupliqué.** Étapes d'onboarding, totaux, statuts, badges = **fonctions
  pures des données**. On ne stocke PAS de `onboarding_step` ; `entreprise ✓ === company !== null`.
  Les totaux facture restent calculés par triggers DB.
- **Types DB générés** depuis Supabase = fichier de types unique. Pas de types DB écrits à la main
  en parallèle.

### 2. Réactivité instantanée — ZÉRO actualisation
Mécanisme officiel = **Supabase Realtime + Optimistic UI**. Le pattern :
```
RSC (paint initial, props) ──▶ Provider client (store live)
                                    ▲            │
   écriture serveur (services) ▶ Postgres ─Realtime─┘  ◀── Stepper / Chat / Dashboard
                                                         lisent le MÊME store live
```
- **Lecture initiale en RSC** (zéro spinner), puis un **provider client** garde la donnée vivante
  via Realtime, scopé `company_id`/`user_id` (RLS-aware). Hooks : `useLiveCompany()`,
  `useLiveInvoices()`, etc.
- **Mutations directes utilisateur** → `useOptimistic`/`useTransition` (React 19) : l'UI bouge
  avant la confirmation serveur, rollback + toast si erreur, Realtime réconcilie.
- **Écritures hors composant (IA, MCP, autre onglet)** → reflétées par Realtime, sans action de
  l'utilisateur.
- **INTERDIT** : `window.location.reload()`. `router.refresh()` toléré uniquement en dernier
  recours, **jamais** sur le flux IA.

### 3. Frontières nettes — 4 couches, aucune fuite
1. **Services** (`src/lib/services/`) : pur, reçoit un `Ctx = { userId, companyId }`, renvoie
   `ServiceResult<T>`, testable, **zéro UI**.
2. **Server boundary** (server actions + route handlers) : `auth → validate(Zod) → service →
   revalidate/return`. Rien d'autre. Pas de SQL, pas de règle métier.
3. **Client state** : providers Realtime + hooks + optimistic.
4. **Présentation** : composants UI **purs** — props in, **aucun** accès Supabase direct, aucune
   logique métier.
- **Zod = schéma unique** partagé client/serveur, **toujours revalidé côté serveur**. On ne fait
  jamais confiance au client.

### 4. Asynchrone & rapidité
- **Paralléliser** les lectures indépendantes (`Promise.all`) — jamais d'`await` en série évitable.
- **Streaming** : `Suspense` + `loading.tsx` par route, skeletons.
- **Effets externes hors chemin critique** (sync Wallet, transmission PDP) : `after()` (Next) ou
  best-effort, **mais avec observabilité** — jamais de `catch {}` muet.
- **Chat IA en streaming**.

### 5. Robustesse
- **TypeScript strict, zéro `any`** (on élimine les `as any` existants).
- **Modèle d'erreur uniforme** : `ServiceResult<T>` partout + messages lisibles
  (`friendlyPdpError` généralisé). Aucune erreur avalée silencieusement.
- **Idempotence** des envois externes (PDP/e-reporting) : clé d'idempotence, pas de double envoi.
- **Sécurité** : RLS (filet) + scoping explicite (ceinture) ; **secrets chiffrés au repos**
  (`claude_api_key`, secret Chorus) ; **rate-limit persistant** (pas de Map mémoire).
- **Scoping cohérent** : tout en `company_id` (uniformiser les devis encore en `user_id`).
- **Migrations** versionnées **et appliquées** (pas de migration « à appliquer manuellement » qui
  traîne).

### 6. UI / i18n / a11y
- **Tout texte via next-intl** — aucune chaîne en dur dans les composants.
- Design tokens shadcn (`bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`…)
  + dark mode + focus/aria. **Aucune couleur en dur.**

---

## Definition of Done (porte de qualité)

Une feature n'est **finie** que si elle coche **tout** :

- [ ] `tsc` vert, **0 `any`**, build vert
- [ ] Écritures via la couche `services/` uniquement
- [ ] Validation Zod **revalidée serveur**
- [ ] Réactivité : optimistic (action user) **et** Realtime (cross-surface) câblés, sans refresh
- [ ] États **loading / erreur / vide** présents
- [ ] Textes en **i18n** (fr + en)
- [ ] **Dark mode** + a11y (focus, aria) OK
- [ ] Erreurs loggées/observables (pas de catch muet)
- [ ] Si écriture : état dérivé recalculé, pas dupliqué

---

## Conventions de structure

```
src/
  app/                # routes : RSC + route handlers (server boundary fin)
  actions/            # server actions : auth → Zod → service → revalidate
  lib/
    services/         # SOURCE DE VÉRITÉ métier (pur, ServiceResult, Ctx)
    realtime/         # providers + hooks live (useLiveCompany, …)
    validations/      # schémas Zod partagés
    pdp/ chorus-pro/ facturx/ mcp/   # intégrations
  components/
    <feature>/        # composants UI purs par domaine
    ui/               # shadcn (ne pas réécrire la logique métier dedans)
  types/              # types DB générés (source unique)
```

## Anti-patterns bannis
- ❌ Logique métier ou requête Supabase dans un composant UI.
- ❌ `window.location.reload()` / refresh pour rafraîchir l'UI.
- ❌ État dérivable stocké en base ou dupliqué côté client.
- ❌ `any` / `as any`, `catch {}` muet, secret en clair, rate-limit en mémoire.
- ❌ Chaîne de texte en dur dans un composant.
- ❌ Écriture en base qui contourne `services/`.
