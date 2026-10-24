# Runbook

## Quick check

```bash
curl -s https://vilatech-ai.vercel.app/api/health
curl -s https://vilatech-ai.vercel.app/api/ai/models
curl -s "$XAVANI_HOST/health"
```

`chat.provider` should be `xavani`. `status` should be `ok` or `degraded`.

## Deploy

1. Merge to the deploy branch after approval.
2. Vercel builds from the repository.
3. Run the quick check.
4. Send one real chat message and one form export.

## Roll back

1. Vercel dashboard, Deployments, promote the last green build.
2. Run the quick check until it reports `ok`.
3. Record the incident in `docs/operations.md`.

## Incident

Follow `docs/security/incident-response.md`. Preserve logs. Do not paste
provider bodies. Rotate keys if exposure is possible.

## Related

- `docs/operations.md` — retention, deletion, failed release.
- `docs/xavani-hosting.md` — Xavani origin, modes, key rotation.
- `docs/security/incident-response.md` — severity and evidence.
