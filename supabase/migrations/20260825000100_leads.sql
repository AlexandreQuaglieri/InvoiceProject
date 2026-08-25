-- Leads marketing (capture d'email du quiz réforme, futures sources).
-- Écriture et lecture UNIQUEMENT via service_role (server action rate-limitée) :
-- RLS activée sans policy anon/authenticated = deny-all pour les clients publics.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'quiz-reforme',
  quiz_who text,
  quiz_billing text,
  locale text,
  created_at timestamptz not null default now(),
  unique (email, source)
);

alter table public.leads enable row level security;

comment on table public.leads is
  'Prospects marketing (emails collectés hors compte). Accès service_role uniquement.';
