-- Run once in Supabase SQL editor (Omera project) so Clerk user ids map to omera_users.
-- File: supabase/migrations/20261017000000_clerk_identity.sql

alter table public.omera_users
  drop constraint if exists omera_users_auth_user_id_fkey;

alter table public.omera_users
  alter column auth_user_id type text using auth_user_id::text;
