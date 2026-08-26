# Contribuer à Factur-IA

Merci de votre intérêt ! Ce projet accepte les contributions : corrections de
bugs, traductions, documentation, nouvelles fonctionnalités.

## Avant de commencer

1. **Lisez [`CLAUDE.md`](CLAUDE.md)** : c'est le contrat d'architecture du projet
   (source de vérité unique, Realtime + optimistic UI, frontières de couches,
   anti-patterns bannis). Toute contribution doit le respecter, qu'elle vienne
   d'un humain ou d'un agent IA.
2. Pour une fonctionnalité nouvelle ou un changement structurant, **ouvrez une
   issue d'abord** pour en discuter, cela évite le travail perdu.
3. Installez le projet en local : voir la section *Installation (self-host)* du
   [README](README.md).

## Règles essentielles (résumé de CLAUDE.md)

- **TypeScript strict, zéro `any`** : `npx tsc --noEmit` doit être vert.
- **Toute écriture en base passe par `src/lib/services/`** : jamais de SQL ni de
  logique métier dans un composant ou un route handler.
- **Validation Zod revalidée côté serveur** : on ne fait jamais confiance au client.
- **Réactivité sans rechargement** : mutations optimistes + Supabase Realtime.
  `window.location.reload()` est interdit.
- **Tout texte utilisateur passe par next-intl** (`src/messages/fr` **et** `en`).
- **Aucune couleur en dur** : tokens shadcn (`bg-background`, `text-muted-foreground`…),
  dark mode et a11y (focus, aria) obligatoires.
- **Aucune erreur avalée** : pas de `catch {}` muet, messages d'erreur lisibles.
- **Migrations** : un fichier `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
  par changement de schéma, avec RLS sur toute nouvelle table.

## Definition of Done

Une PR n'est prête que si :

- [ ] `npx tsc --noEmit` et `npm run build` passent
- [ ] Textes FR **et** EN ajoutés dans `src/messages/`
- [ ] États loading / erreur / vide présents
- [ ] Dark mode et a11y vérifiés
- [ ] Écritures via la couche `services/` uniquement
- [ ] Pas de secret, de donnée personnelle réelle ni d'URL d'infrastructure
      privée dans le code ou les exemples

## Process

1. Forkez, créez une branche (`fix/...` ou `feat/...`).
2. Commits clairs, en français ou en anglais (`type(scope): description`).
3. Ouvrez la PR vers `master` en décrivant le problème résolu et la façon de tester.

## Licence

En contribuant, vous acceptez que votre contribution soit publiée sous licence
[AGPL-3.0](LICENSE).
