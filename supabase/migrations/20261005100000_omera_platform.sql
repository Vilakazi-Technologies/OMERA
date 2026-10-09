-- Omera platform: users, chats, form sessions (VILATECH)

create table if not exists public.omera_users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.omera_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.omera_users (id) on delete cascade,
  title text not null default 'New chat',
  mode text not null default 'chat' check (mode in ('chat', 'form')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists omera_conversations_user_updated_idx
  on public.omera_conversations (user_id, updated_at desc);

create table if not exists public.omera_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.omera_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists omera_messages_conversation_idx
  on public.omera_messages (conversation_id, created_at asc);

create table if not exists public.omera_form_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.omera_users (id) on delete cascade,
  conversation_id uuid references public.omera_conversations (id) on delete set null,
  file_name text not null,
  storage_path text,
  fields_json jsonb not null default '[]'::jsonb,
  current_index int not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  language_id text not null default 'eng',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists omera_form_sessions_user_idx
  on public.omera_form_sessions (user_id, updated_at desc);

alter table public.omera_users enable row level security;
alter table public.omera_conversations enable row level security;
alter table public.omera_messages enable row level security;
alter table public.omera_form_sessions enable row level security;

-- Server uses service role; block direct client access until Supabase Auth is wired.
create policy "omera_users_service_only" on public.omera_users
  for all using (false) with check (false);

create policy "omera_conversations_service_only" on public.omera_conversations
  for all using (false) with check (false);

create policy "omera_messages_service_only" on public.omera_messages
  for all using (false) with check (false);

create policy "omera_form_sessions_service_only" on public.omera_form_sessions
  for all using (false) with check (false);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'omera-forms',
  'omera-forms',
  false,
  52428800,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;
