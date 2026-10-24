# Dependency policy

## Pins

- Runtime dependencies use exact versions in `package.json`.
- `package-lock.json` is committed.
- A lockfile change ships in the same commit as the manifest change.

## Audits

- Run `npm audit` before every release.
- Any new critical or high finding blocks the release until the owner decides.
- Record the result in `docs/security/dependency-audit.md`.

## Upgrades

1. Create a branch named `security/<package>-<version>`.
2. Change one package line.
3. Run lint, typecheck, the full test suite, and the build.
4. Run `npm audit` again.
5. Record the before and after counts.
6. Merge only with owner approval.

## Forbidden

- `npm audit fix --force` without approval.
- An unpinned `latest` tag.
- A dependency added for a single helper that the standard library already
  provides.

## Review cadence

Monthly, or before a funding demo, whichever comes first.
