-- Clerk user ids (e.g. user_xxx) replace Supabase Auth UUID linkage.

alter table public.omera_users
  drop constraint if exists omera_users_auth_user_id_fkey;

alter table public.omera_users
  alter column auth_user_id type text using auth_user_id::text;

comment on column public.omera_users.auth_user_id is
  'External auth provider user id (Clerk). Null for legacy demo rows.';
