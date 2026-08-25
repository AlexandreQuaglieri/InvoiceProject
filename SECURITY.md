# Politique de sécurité

Factur-IA manipule des données de facturation et des documents comptables :
les signalements de vulnérabilités sont pris au sérieux et traités en priorité.

## Signaler une vulnérabilité

**Ne créez pas d'issue publique pour une faille de sécurité.**

- De préférence : ouvrez un **avis de sécurité privé** sur GitHub
  (*Security → Report a vulnerability* sur le repo).
- À défaut : contactez l'éditeur via l'adresse indiquée sur
  [facturation.quatools.fr/legal/mentions-legales](https://facturation.quatools.fr/legal/mentions-legales).

Merci d'inclure : version/commit concerné, étapes de reproduction, impact
estimé, et si possible un correctif suggéré.

Vous recevrez un accusé de réception sous 72 h. Merci de laisser un délai
raisonnable pour corriger avant toute divulgation publique.

## Périmètre

- Instance hébergée : `https://facturation.quatools.fr` (tests non destructifs
  uniquement, pas de données de tiers, pas de déni de service).
- Code du repo : toutes les branches publiées.

## Bonnes pratiques pour les self-hosteurs

- Ne commitez jamais votre `.env.local` ; gardez `SUPABASE_SERVICE_ROLE_KEY`
  et `APP_ENCRYPTION_KEY` strictement côté serveur.
- Gardez la RLS activée : les migrations la posent sur toutes les tables.
- Définissez `CRON_SECRET` et `NEXT_PUBLIC_APP_URL` en production.
