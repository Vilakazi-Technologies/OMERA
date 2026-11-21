-- Ensure the briefing column exists and raise the form bucket to 20 MB.
-- Idempotent: safe to run on a database that already has brief_json.
alter table public.omera_form_sessions
  add column if not exists brief_json jsonb;

update storage.buckets
set file_size_limit = 20000000
where id = 'omera-forms';
