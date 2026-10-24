# Incident response

## Severity

| Level | Example | Response |
|---|---|---|
| SEV1 | Service role key exposed, cross-tenant read | Immediate rotation, freeze deploys, notify owner |
| SEV2 | Auth bypass on one route, data loss | Rotate affected keys, patch, deploy |
| SEV3 | Abuse of quota or cost, single-tenant issue | Rate limit, contact user |
| SEV4 | Minor information disclosure | Fix in the next release |

## First 15 minutes

1. Record the time, the reporter, and the affected route.
2. Freeze deploys. Do not merge.
3. Capture evidence: status codes, request ids, timestamps. Never copy provider
   bodies or customer content into chat.
4. Decide the severity with the owner.

## Containment

- Rotate the suspect key first.
- Disable the affected route with a feature gate if rotation is not enough.
- Preserve logs before any redeploy.

## Commands

```bash
curl -s https://vilatech-ai.vercel.app/api/health
git log --oneline -20
```

## Notification

- SEV1 and SEV2: notify the owner immediately.
- Personal data exposure: follow `docs/security/privacy-popia.md`. The operator
  decides on regulator and data-subject notice with legal advice.
- Do not name a suspected person in writing.

## Recovery

1. Patch with a test that fails before the fix.
2. Deploy the fix.
3. Run the quick check and one real chat.
4. Rotate every key that could have been exposed.

## Post-incident

Write a short review: timeline, root cause, what detected it, what missed it,
and one owner per follow-up. Add it to `docs/operations.md`.
