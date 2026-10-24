# Secure development checklist

Use this list for every change.

## Before code

- [ ] The change has a test that fails first.
- [ ] The threat model covers the new data flow.
- [ ] New inputs have a size limit and a schema.

## Code

- [ ] Private routes call `requireIdentity`.
- [ ] Mutating routes call `requireRequestOrigin`.
- [ ] Uploads check MIME and magic bytes.
- [ ] No secret in client code or a `NEXT_PUBLIC_` variable.
- [ ] Error bodies stay neutral.
- [ ] User text renders as text, never HTML.
- [ ] No customer content in logs.

## Dependencies

- [ ] New package has a reason and an audit line.
- [ ] No `npm audit fix --force`.
- [ ] Lockfile updated in the same commit.

## Review

- [ ] Security-relevant changes get a second reader.
- [ ] The guard tests pass.
- [ ] `npm run typecheck`, `npm run test`, `npm run build` pass.

## Release

- [ ] `/api/health` reports `ok` or a documented `degraded`.
- [ ] One real chat and one form export were tested.
- [ ] Rollback path is known.
