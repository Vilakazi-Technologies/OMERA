# Security policy and rules

These rules apply to every change.

## Secrets

- Secrets live in Vercel environment variables or `.env.local`. Never in git.
- A Supabase service role key never has a `NEXT_PUBLIC_` prefix.
- Provider keys live only on the Xavani host.
- Rotate the Xavani service key with the two-key procedure in
  `docs/xavani-hosting.md`.
- A leaked key is rotated first and investigated second.

## Access

- Clerk is the only identity provider.
- Every private route calls `requireIdentity`.
- Every state-changing route calls `requireRequestOrigin`.
- Ownership is checked in the query, not in the UI.

## Input

- Every body has a byte limit.
- Every upload has a MIME allowlist and a magic-byte check.
- Client-supplied storage paths are rejected.
- Unknown JSON fields are rejected on strict contracts.

## Output

- Error bodies use stable codes and never include provider text.
- Model output renders as text, never HTML.
- Private responses use `Cache-Control: private, no-store`.

## Logging

- No message text, form answers, audio, or keys in logs.
- Log route, status, and a request id.
- Incident notes never include provider bodies.

## Dependencies

- Exact pins in `package-lock.json`.
- `npm audit` before every release.
- One upgrade per branch, full gates, owner approval.

## Review

- Security-relevant changes need a second reader.
- The checklist is `docs/security/secure-development.md`.
