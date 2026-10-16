# Setting up Omera (operator guide)

This is the cleaned-up version of **`setting up millions.md`** in the repo root. “Millions” here means **getting Omera set up end-to-end**, not a separate product.

Omera needs **Supabase** and **Xavani** (recommended). **Lelapa** is optional for voice.

Do not treat an environment variable as verified until you test the service.

## Architecture

```
Browser → Omera (Next.js) → Xavani API → AI provider (OpenRouter, OpenAI, etc.)
                         → Supabase (auth + data)
                         → Lelapa (voice only)
```

**Important:** The **provider key** (e.g. `OPENROUTER_API_KEY`) belongs in **Xavani’s** environment.  
`XAVANI_API_KEY` on Omera is only the **service key** that authenticates Omera to Xavani — not the OpenRouter key.

**Interim on Vercel:** If Xavani is not hosted yet, Omera can use **OpenRouter directly** when `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` are set and `XAVANI_*` is unset. See `docs/vercel-production-setup.md`.

## 1. Repositories

```powershell
git clone --branch feat/omera-integration https://github.com/Vilakazi-Technologies/OMERA.git OMERA
cd OMERA
git pull origin feat/omera-integration

git clone --branch feat/omera-api-mode https://github.com/enternovate/xavani-agent.git ..\xavani-agent
```

- **Node.js 24.21.0** for Omera (`package.json` engines).
- **Python 3.11** for Xavani (3.11 ≤ version &lt; 3.14).

Windows helper: `.\scripts\setup-xavani-windows.ps1` (from repo root).

## 2. Supabase

Use the project the owner invited you to (e.g. `lpnlyethmoilqwoekvmc`).

In **SQL Editor**, run **all four** migrations **in order**:

1. `supabase/migrations/20261005100000_omera_platform.sql`
2. `supabase/migrations/20261014090000_omera_identity.sql`
3. `supabase/migrations/20261014091000_omera_request_limits.sql`
4. `supabase/migrations/20261014092000_omera_form_documents.sql`

**Auth → Providers:** enable **Email** (OTP).

**Auth → URL configuration** — add:

| Environment | Site URL / redirects |
|-------------|----------------------|
| Local | `http://127.0.0.1:3000` and `http://127.0.0.1:3000/auth/callback` |
| Production | `https://vilatech-ai.vercel.app` and `https://vilatech-ai.vercel.app/auth/callback` |

Copy from **Project Settings → API**:

- Project URL → `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
- `anon` JWT → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` JWT → `SUPABASE_SERVICE_ROLE_KEY` (server only)

## 3. Xavani (local — recommended for full stack)

```powershell
cd ..\xavani-agent
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

Set a dedicated home (example):

```powershell
$env:XAVANI_HOME = "$env:USERPROFILE\.xavani-omera"
New-Item -ItemType Directory -Force -Path $env:XAVANI_HOME
```

Create `%USERPROFILE%\.xavani-omera\.env`:

```env
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
API_SERVER_KEY=<generate a long random secret — same value as Omera XAVANI_API_KEY>
API_SERVER_MODEL_NAME=omera
OPENROUTER_API_KEY=<your OpenRouter key>
```

Add to `%USERPROFILE%\.xavani-omera\config.yaml`:

```yaml
platforms:
  api_server:
    enabled: true
    extra:
      omera_mode: true
```

Configure the **underlying model** in Xavani per Shivani’s docs (e.g. OpenRouter model `nvidia/nemotron-3.5-super-vl:free`).

Start:

```powershell
xavani gateway
```

Base URL for Omera: `http://127.0.0.1:8642/`

## 4. Omera `.env.local`

```powershell
cd OMERA
copy .env.example .env.local
# Or: npx vercel env pull .env.local --environment=production
```

**Local (Xavani path):**

```env
APP_ORIGIN=http://127.0.0.1:3000
OMERA_DEMO_MODE=false
XAVANI_BASE_URL=http://127.0.0.1:8642/
XAVANI_API_KEY=<same as API_SERVER_KEY>
XAVANI_MODEL=omera
SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
LELAPA_API_KEY=...
```

**Local (OpenRouter-only, no Xavani):** leave `XAVANI_*` empty; set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL=nvidia/nemotron-3.5-super-vl:free`.

```powershell
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) → sign in with email OTP → chat → form fill.

## 5. Verify

- [http://127.0.0.1:3000/api/health](http://127.0.0.1:3000/api/health) — `database.reachable: true`; `chat.configured: true`; `chat.provider` = `xavani` or `openrouter`.
- Send a real chat message (health does not prove inference).
- `npm run typecheck`, `npm run test`, `npm run build`

Production: [docs/vercel-production-setup.md](./vercel-production-setup.md) — hosted Xavani **or** OpenRouter on Vercel.

## 6. Owner approvals still required

See `setting up millions.md` §9 and `docs/AGENDA.md`.
