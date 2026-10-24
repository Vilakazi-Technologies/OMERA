# API reference

Every route runs on the Node.js runtime. Private routes require a Clerk session.
State-changing routes also require an exact `APP_ORIGIN` match. The guard test
`tests/unit/route-guards.test.ts` enforces that rule for every mutating route.

| Route | Methods | Auth | Origin | Limit |
|---|---|---|---|---|
| `/api/health` | GET | public | no | none |
| `/api/capabilities` | GET | public | no | none |
| `/api/ai/models` | GET | public | no | none |
| `/api/auth/session` | GET | public | no | none |
| `/api/chat` | POST | Clerk | yes | 256 KB body, 150 requests per user |
| `/api/conversations` | GET, POST | Clerk | POST yes | 256 KB body |
| `/api/conversations/[id]` | GET, PATCH, DELETE | Clerk | PATCH, DELETE yes | 256 KB body |
| `/api/conversations/[id]/messages` | POST | Clerk | yes | 256 KB body |
| `/api/csv/analyze` | POST | Clerk | yes | quota |
| `/api/forms/analyze` | POST | Clerk | yes | 4.1 MB multipart, 10 per minute |
| `/api/forms/sessions` | GET | Clerk | no | none |
| `/api/forms/sessions/[id]` | GET, PATCH, DELETE | Clerk | PATCH, DELETE yes | revision check |
| `/api/forms/sessions/[id]/export` | GET | Clerk | no | owned session only, 8 MB response |
| `/api/transcribe` | POST | Clerk | yes | 2.8 MB body, 20 per minute |
| `/api/store/complete-json` | POST | gateway secret | no | allowlisted |
| `/api/store/complete-vision-json` | POST | gateway secret | no | allowlisted |

## Error format

```json
{ "error": "CODE" }
```

Codes are stable. Unknown failures return `SERVICE_UNAVAILABLE` with status 503.
Provider text never reaches the client.

| Status | Codes |
|---|---|
| 400 | `INVALID_REQUEST`, `INVALID_JSON`, `INVALID_MULTIPART`, `INVALID_CHOICE` |
| 401 | `UNAUTHORIZED` |
| 403 | `ORIGIN_FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `REVISION_CONFLICT` |
| 413 | `FILE_TOO_LARGE`, `REQUEST_TOO_LARGE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 422 | `UNSUPPORTED_XFA`, `SIGNATURE_REQUIRES_REVIEW`, `NO_FILLABLE_FIELDS` |
| 429 | `QUOTA_EXCEEDED`, `RATE_LIMITED` |
| 503 | `SERVICE_UNAVAILABLE`, `FORMS_STORAGE_UNAVAILABLE` |

## Response headers

- `Cache-Control: private, no-store` on private responses.
- `X-Accel-Buffering: no` on the chat stream.
- Security headers come from `next.config.ts`.

## Related

- `tests/routes/` holds the contract for each route.
- `docs/security/threat-model.md` maps threats to routes.
