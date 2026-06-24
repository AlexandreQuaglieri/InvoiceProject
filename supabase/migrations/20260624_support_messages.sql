-- Messages d'assistance envoyés depuis l'app (bouton « Assistance » du panneau
-- assistant). Stockés ici ; le hub de notification les relèvera plus tard pour
-- alerter l'équipe — rien n'est perdu entre-temps.
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  subject text,
  message text not null,
  status text not null default 'new', -- new | read | answered
  created_at timestamptz not null default now()
);

alter table public.support_messages enable row level security;

-- L'utilisateur authentifié crée ses propres messages…
create policy "support_messages_insert_own"
  on public.support_messages for insert to authenticated
  with check (auth.uid() = user_id);

-- …et relit uniquement les siens.
create policy "support_messages_select_own"
  on public.support_messages for select to authenticated
  using (auth.uid() = user_id);
