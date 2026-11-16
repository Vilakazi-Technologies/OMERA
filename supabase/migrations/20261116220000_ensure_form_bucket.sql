-- Production bucket may be missing (UPDATE-only migrations are no-ops) or
-- still capped at 4 MB from 20261024090000_tighten_form_bucket.sql.
-- Service-role uploads still need the bucket row; MIME must be application/pdf.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'omera-forms',
  'omera-forms',
  false,
  10000000,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anon/authenticated stay denied by default (no policies). Service role
-- bypasses RLS; these policies are a fallback if the Storage API still
-- evaluates policies for the JWT role.
drop policy if exists "omera_forms_service_insert" on storage.objects;
drop policy if exists "omera_forms_service_select" on storage.objects;
drop policy if exists "omera_forms_service_update" on storage.objects;
drop policy if exists "omera_forms_service_delete" on storage.objects;

create policy "omera_forms_service_insert"
  on storage.objects for insert to service_role
  with check (bucket_id = 'omera-forms');

create policy "omera_forms_service_select"
  on storage.objects for select to service_role
  using (bucket_id = 'omera-forms');

create policy "omera_forms_service_update"
  on storage.objects for update to service_role
  using (bucket_id = 'omera-forms')
  with check (bucket_id = 'omera-forms');

create policy "omera_forms_service_delete"
  on storage.objects for delete to service_role
  using (bucket_id = 'omera-forms');
