# Architecture

## Runtime

```
Browser
  -> Next.js on Vercel (vilatech-ai)
       -> Clerk            identity
       -> Supabase         conversations, form sessions, private objects
       -> Xavani           stateless chat and form-label inference
            -> model provider (optional)
       -> Lelapa           speech transcription (optional)
```

The browser talks only to the Next.js origin. Every provider call happens on the
server.

## Trust boundaries

| Boundary | Trust | Control |
|---|---|---|
| Browser to Next.js | untrusted input | Clerk session, exact origin check, schema validation, body limits |
| Next.js to Xavani | semi-trusted | bearer service key, capability contract check, response size cap |
| Next.js to Supabase | trusted | service role key, server only, RLS bypassed by design |
| Next.js to Lelapa | semi-trusted | server-only key, bounded audio |
| Provider output to UI | untrusted text | rendered as text, never HTML |

## Chat request flow

1. Clerk verifies the session.
2. `requireRequestOrigin` compares `Origin` with `APP_ORIGIN`.
3. `chatRequestSchema` validates roles, sizes, and language.
4. `consumeQuota` counts the request.
5. `createConfiguredChatStream` probes Xavani capabilities (2 s, cached).
6. Xavani answers; Omera forwards SSE tokens.
7. A complete answer is saved. A partial answer is not.

## Form request flow

1. Clerk session and origin check.
2. Multipart read with a 4.1 MB cap; file capped at 4 MB.
3. Magic bytes and MIME checked; XFA, encryption, and signatures rejected.
4. Bytes stored under a server-derived path: `<userId>/<sessionId>/<file>`.
5. Field labels go to Xavani for translation only. Canonical ids never change.
6. Answers patch with a revision check.
7. Export verifies the stored SHA-256, then fills with pdf-lib.

## Secrets

| Secret | Lives on | Never |
|---|---|---|
| `CLERK_SECRET_KEY` | Vercel server env | client bundle |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel server env | client bundle |
| `XAVANI_API_KEY` | Vercel server env | client bundle, Xavani logs |
| Model provider key | Xavani host only | Omera |
| `LELAPA_API_KEY` | Vercel server env | client bundle |
| `VILATECH_STORE_SECRET` | Vercel server env | client bundle |

## Failure modes

| Failure | Behavior |
|---|---|
| Xavani down | Omera probes, then falls back to OpenRouter if configured |
| Model 429 | Xavani tries the next model |
| Supabase down | `/api/health` reports `degraded` or `unavailable`; forms return 503 |
| Clerk down | Private routes reject; public pages still load |
| Lelapa down | Transcription fails; typing still works |

## Related

- `docs/data-model.md`
- `docs/api.md`
- `docs/security/threat-model.md`
- `docs/xavani-hosting.md`
