-- Omera verified identity: link application users to Supabase Auth.
-- New verified users are created with email null; verified ownership lives
-- in Supabase Auth. Legacy demo rows stay outside auth_user_id mappings and
-- are never merged by email.

alter table public.omera_users
  add column if not exists auth_user_id uuid references auth.users (id) on delete cascade;

create unique index if not exists omera_users_auth_user_id_uidx
  on public.omera_users (auth_user_id);

comment on column public.omera_users.auth_user_id is
  'Supabase Auth user id. Null for legacy demo rows, which are never mapped by email.';
