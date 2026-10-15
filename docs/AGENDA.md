# Vilakazi / Omera integration agenda

**Status:** Owner-approved merge (second and final integration handover version)  
**Date:** 2026-10-15 (UTC)  
**PR:** [#1 — Omera AI integration](https://github.com/Vilakazi-Technologies/OMERA/pull/1) (merged to `main`)  
**Approver:** Ayanda (Vilakazi Technologies product owner)

## Group decision

The XAVANI / integration team delivered a build that does **not** yet satisfy every item in `XAVANI-INSTRUCTIONS.md` for live production. **We still approve merging PR #1** as the shared baseline so Shivani and Vilakazi can move forward together.

### Approved for this release

| Item | Decision |
|------|----------|
| Chat runtime | Xavani restricted runtime (no direct OpenAI in the app) |
| Voice | Ship honest **4-route** matrix per `docs/voice-support.md`; remaining official languages need dated rollout or verified fallback |
| Chat quota | **60 requests per user** |
| Dependencies | No dependency bumps in this merge; findings in `docs/security-review.md` accepted as recorded risk |
| Forms | Completed PDF export path in codebase; real-world form validation (E3) still owner/tester follow-up |

### Explicitly not claimed as done (post-merge milestones)

- Live Xavani service verification (X03)
- E1 business-expert scenario sign-off
- E2 native-language quality across all eleven languages
- E3 three real production PDF forms
- E5 deployment / env on isolated Supabase
- Playwright browser binaries where e2e is run locally

## Next actions

1. **Integrator:** Continue from `main`; track blockers in PRs linked to items above.
2. **Owner:** Vercel deploy from `main` when env (Supabase, Xavani) is ready.
3. **Everyone:** Treat `README.md`, `XAVANI-INSTRUCTIONS.md`, and `docs/*` as source of truth for scope.

## Local checkout (Ayanda / team)

```bash
cd vilatech-ai   # or clone OMERA
git checkout main
git pull origin main
npm install
cp .env.example .env.local
npm run dev
```

Production (until Git-connected deploy): [vilatech-ai.vercel.app](https://vilatech-ai.vercel.app) — redeploy after merging `main`.
