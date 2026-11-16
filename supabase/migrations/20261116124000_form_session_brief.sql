-- Document briefing JSON for mixed tenders / RFPs / RFQs (not only AcroForms).
alter table public.omera_form_sessions
  add column if not exists brief_json jsonb;
