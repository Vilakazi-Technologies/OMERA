-- Omera form documents: immutable document metadata + review status (I4).
-- The original platform migration stays unchanged; this migration only adds.

alter table public.omera_form_sessions
  add column if not exists document_sha256 text,
  add column if not exists document_kind text,
  add column if not exists revision int not null default 1;

-- Widen the inherited status check ('in_progress', 'completed') with 'review'.
-- The inherited check carries the default Postgres name; drop it if present.
alter table public.omera_form_sessions
  drop constraint if exists omera_form_sessions_status_check;

alter table public.omera_form_sessions
  add constraint omera_form_sessions_status_check
  check (status in ('in_progress', 'review', 'completed'));

alter table public.omera_form_sessions
  drop constraint if exists omera_form_sessions_document_kind_check;

alter table public.omera_form_sessions
  add constraint omera_form_sessions_document_kind_check
  check (document_kind is null or document_kind in ('acroform', 'flat'));

alter table public.omera_form_sessions
  drop constraint if exists omera_form_sessions_sha_format_check;

alter table public.omera_form_sessions
  add constraint omera_form_sessions_sha_format_check
  check (document_sha256 is null or document_sha256 ~ '^[0-9a-f]{64}$');

create index if not exists omera_form_sessions_document_idx
  on public.omera_form_sessions (user_id, document_sha256);
