# Data model

All tables live in the `public` schema. Every table has row level security
enabled with a service-only policy. The server uses the service role key, which
bypasses RLS. RLS protects against misuse of any anon key; server code is the
real authorization boundary.

| Table or bucket | Owner column | Purpose | Notes |
|---|---|---|---|
| `omera_users` | `id` | Product user record | `auth_user_id` stores the Clerk id |
| `omera_conversations` | `user_id` | Chat and form conversations | cascades to messages |
| `omera_messages` | via conversation | Message rows | role and content |
| `omera_form_sessions` | `user_id` | One upload and its answers | `fields_json`, `current_index`, `status`, `language_id` |
| `omera_request_counts` | `user_id` | Quota windows | consumed by `consumeQuota` |
| `storage.objects` bucket `omera-forms` | path prefix `<userId>/` | Private PDF bytes | bucket is not public |

Columns are defined in `supabase/migrations/`. Read the migration before you
change a query.

## Storage

- Bucket: `omera-forms`, private.
- Path: `<userId>/<sessionId>/<file>`. The server derives every segment.
- Upload limit: 4 MB, PDF only, enforced in code and in the bucket.
- No public URL is issued. Downloads go through an authenticated route.

## RLS

Every table uses:

```sql
alter table public.<table> enable row level security;
create policy "<table>_service_only" on public.<table>
  for all using (false) with check (false);
```

`using (false)` blocks anon and authenticated roles. Only the service role,
which bypasses RLS, can read or write.

## Retention

No automatic purge job exists. Conversations, messages, form sessions, and
objects persist until the product deletes them or the operator removes them.
A retention schedule is an owner decision, recorded in `docs/operations.md`.

## Personal data

| Data | Table or bucket | Sensitivity |
|---|---|---|
| Clerk user id | `omera_users.auth_user_id` | identifier |
| Email | `omera_users.email` | personal |
| Chat text | `omera_messages.content` | may contain business and personal data |
| Form answers | `omera_form_sessions.fields_json` | may contain identity data |
| Uploaded documents | `omera-forms` | may contain identity data |
| Audio | not stored | sent to Lelapa only |

See `docs/security/privacy-popia.md`.
