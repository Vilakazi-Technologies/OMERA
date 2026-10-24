# Threat model

## Assets

| Asset | Why it matters |
|---|---|
| Clerk session | Full account access |
| Supabase service role key | Reads and writes every row and object |
| Xavani service key | Spends model budget, reads customer prompts |
| Provider key | Billing and model access |
| Chat content | Business plans, personal data |
| Form documents | Identity documents, signatures |
| POPIA personal data | Legal exposure |

## Actors

| Actor | Capability |
|---|---|
| Anonymous internet | Public pages and public API routes |
| Signed-in user | Own conversations and forms |
| Malicious signed-in user | Tries to read or write other users' data |
| Malicious PDF author | Controls text inside an uploaded form |
| Compromised dependency | Runs inside the Next.js process |
| Insider | Has repository or dashboard access |

## Entry points

`/api/chat`, `/api/conversations*`, `/api/csv/analyze`, `/api/forms/*`,
`/api/transcribe`, `/api/store/*`, Clerk webhooks and redirects.

## STRIDE

| Threat | Example | Control | Status |
|---|---|---|---|
| Spoofing | forged Origin on a write | exact `APP_ORIGIN` match on every mutating route | Open on three conversation routes until fixed |
| Tampering | client writes form metadata | server-derived fields and revision checks | Mitigated |
| Repudiation | no request trail | neutral logs; request IDs planned | Accepted |
| Information disclosure | service key in the bundle | server-only env, no `NEXT_PUBLIC_` secrets | Mitigated |
| Denial of service | upload or transcribe flood | quota on chat and CSV; rate limits on forms and transcribe | Partial |
| Elevation of privilege | reading another user's session | ownership checks plus RLS | Mitigated |
| Prompt injection | PDF label says "ignore instructions" | data-not-instructions rule in the prompt | Open until fixed |
| Supply chain | vulnerable Next.js release | audit plus staged upgrade | Mitigated: 16.4.3 merged, audit clean |

## Findings

| ID | Finding | Severity | Status |
|---|---|---|---|
| S1 | Next.js 16.2.12 advisories: 1 critical, 2 high | Critical | Fixed: `next@16.4.3`, audit clean |
| S2 | No security headers and no CSP | High | Fixed |
| S3 | Conversation writes skip the origin check | High | Fixed |
| S4 | No rate limit on transcribe and form analysis | Medium | Fixed |
| S5 | Store secret compare is not constant time | Low | Fixed |
| S6 | Form bucket allows 50 MB and six MIME types | Medium | Fixed |
| S7 | Form prompt does not forbid embedded instructions | Medium | Fixed |
| S8 | No retention purge job | Medium | Accepted; owner decision |
| S9 | Repository history contains local email addresses | Low | Accepted; rewrite needs approval |
| S10 | No WAF or bot layer | Low | Accepted; platform defaults |

## Residual risk

The service role key is the highest-value secret. Any server-side code execution
compromises every tenant. That is why the Next.js advisories are urgent even
when the affected features are unused.

## Review

Review this model when a route, a provider, or a data store changes.
