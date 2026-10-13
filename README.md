# OMERA (VILATECH AI)

Stakeholder-ready web app for **Omera** — ChatGPT-style chat plus **voice-powered form filling** for South African users.

**Production:** [vilatech-ai.vercel.app](https://vilatech-ai.vercel.app)  
**Organization:** [Vilakazi-Technologies/OMERA](https://github.com/Vilakazi-Technologies/OMERA)

**Integrator handover:** see [`XAVANI-INSTRUCTIONS.md`](./XAVANI-INSTRUCTIONS.md) for product vision, priorities, and definition of done.

## Run locally

```bash
cd vilatech-ai
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stakeholder demo script

1. **Home** → *Try for free* → enter email (optional) → *Continue*
2. **Chat** → try a suggestion or ask about Metropolitan / languages
3. **Form fill** (sidebar) → upload any PDF → answer questions via mic or keyboard
4. Show **language selector** (eleven official languages; Lelapa when API key is set)
5. **Add to Home Screen** on mobile (PWA manifest) for “app” experience

## AI chat (OpenAI)

1. Copy `.env.example` → `.env.local`
2. Set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, default `gpt-4o-mini`)
3. Restart `npm run dev`

Without a key, chat stays in **demo mode** (canned streaming replies). On Vercel, add the same variables under Project → Settings → Environment Variables, then redeploy.

Check status: `GET /api/health` → `{ chat: { mode: "openai" | "demo" } }`

## Voice (server)

Set `LELAPA_API_KEY` in `.env.local` / Vercel for live transcription. Without it, voice uses demo transcripts.

## Supabase (chat history + forms)

Migration: `supabase/migrations/20261005100000_omera_platform.sql` (applied to project `mjxfpovawoztumfcblhm` — `meeting-pro-web`).

Vercel / `.env.local`:

- `SUPABASE_URL` — e.g. `https://mjxfpovawoztumfcblhm.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — **server only**, never `NEXT_PUBLIC_`

After login, chats and form sessions persist via API routes. `/api/health` reports `database.configured`.

## Deploy

```bash
npm run build
npm start
```

Vercel project: **vilatech-ai** (linked via `.vercel` locally; not committed). Set env vars from `.env.example`, then `npx vercel deploy --prod` or connect this repo in the Vercel dashboard for Git-based deploys.

## This week vs next month

| Ready now | Next milestone |
|-----------|----------------|
| Product UI (web + PWA) | Filled PDF export |
| Form Q&A flow | Real PDF field detection |
| Demo chat streaming | OpenAI / Anthropic production chat |
| Lelapa integration hook | Full 11-language STT coverage |

Built by **VILATECH** — South Africa.
