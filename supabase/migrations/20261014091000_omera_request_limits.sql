-- Omera request quotas: atomic per-user counter consumed through a
-- service-role-only function. No client-supplied count is ever trusted.

create table if not exists public.omera_request_counts (
  user_id uuid primary key references public.omera_users (id) on delete cascade,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.omera_request_counts enable row level security;

drop policy if exists "omera_request_counts_service_only" on public.omera_request_counts;
create policy "omera_request_counts_service_only" on public.omera_request_counts
  for all using (false) with check (false);

create or replace function public.omera_consume_request_quota(p_user_id uuid, p_limit integer)
returns table (allowed boolean, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_limit is null or p_limit < 1 then
    raise exception 'INVALID_QUOTA_LIMIT';
  end if;
  insert into public.omera_request_counts (user_id, request_count, updated_at)
  values (p_user_id, 1, now())
  on conflict (user_id) do update set
    request_count = public.omera_request_counts.request_count + 1,
    updated_at = now()
  returning public.omera_request_counts.request_count into v_count;
  if v_count > p_limit then
    return query select false, 0;
  else
    return query select true, p_limit - v_count;
  end if;
end;
$$;

revoke all on function public.omera_consume_request_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.omera_consume_request_quota(uuid, integer) to service_role;
