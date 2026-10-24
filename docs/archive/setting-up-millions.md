> **ARCHIVED 2026-10-24.** Omera uses Clerk for authentication. This document
> describes the removed Supabase Auth flow. Keep it for history only.

# Setting up Omera

> **Operator guide (Windows + Vercel + all migrations):** see [`docs/setting-up-omera.md`](../setting-up-omera.md).

This guide helps an operator set up Omera from the source repositories. Omera needs Supabase and Xavani. Voice input also needs Lelapa.

Do not treat an environment variable with text as a verified credential. Test each service before customer use.

## 1. Understand the services

- Omera provides the web app, chat interface, form flow, PDF handling, and Supabase integration.
- Supabase provides email sign-in, database storage, and private form storage.
- Xavani provides chat replies and form analysis through its API server.
- A model provider supplies the AI model that Xavani uses.
- Lelapa transcribes speech. Omera does not need Lelapa for typed chat.

The request flow is:

    Browser -> Omera server -> Xavani API server -> selected AI model
    Omera server -> Supabase
    Omera server -> Lelapa, when the user uses voice

## 2. Obtain the repositories

Use the Omera branch after an authorized maintainer publishes its latest commits.

    git clone --branch feat/omera-integration https://github.com/Vilakazi-Technologies/OMERA.git OMERA

Obtain the Omera-compatible Xavani branch:

    git clone --branch feat/omera-api-mode https://github.com/enternovate/xavani-agent.git xavani-agent

Install Node 24.21.0 for Omera. Install Python 3.11 for Xavani. The Xavani project requires Python 3.11 or later, but below 3.14.

The Omera README uses a project-local Node path. A fresh clone may not contain that ignored runtime folder. Install Node 24.21.0 if the folder does not exist.

## 3. Create the Supabase project

Ask the product owner to confirm the project name, region, and data requirements. Create a dedicated Omera project in the Supabase dashboard.

Open the Supabase SQL Editor. Run **all four** migrations in order on the new project:

    supabase/migrations/20261005100000_omera_platform.sql
    supabase/migrations/20261014090000_omera_identity.sql
    supabase/migrations/20261014091000_omera_request_limits.sql
    supabase/migrations/20261014092000_omera_form_documents.sql

The migration creates Omera tables and a private `omera-forms` storage bucket. It enables row-level security and blocks direct client access to Omera tables.

Configure Supabase Auth:

1. Enable email authentication with one-time codes.
2. Add `http://127.0.0.1:3000` to the allowed local site and redirect URLs.
3. Copy the project URL and anon key.
4. Copy the service role key for server use only.

Do not expose the service role key to the browser. Do not commit any Supabase key.

## 4. Configure the Xavani service

Use a separate Xavani home for Omera. Do not use a personal Xavani profile or personal credentials.

    cd xavani-agent
    python3.11 -m venv .venv
    source .venv/bin/activate
    python -m pip install -e .
    export XAVANI_HOME="$HOME/.xavani-omera"
    mkdir -p "$XAVANI_HOME"

Create `$XAVANI_HOME/.env`. Add these settings:

    API_SERVER_ENABLED=true
    API_SERVER_HOST=127.0.0.1
    API_SERVER_PORT=8642
    API_SERVER_KEY=<new random service key>
    API_SERVER_MODEL_NAME=omera
    <provider key variable>=<provider key>

Generate a unique service key. Keep it in a password manager. Do not paste it into chat.

Choose the provider and the actual AI model with the product owner. Add the provider key to the Xavani environment. Examples include `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY`. Use only the variable for the selected provider.

Set the selected provider and model in the dedicated Xavani configuration. Xavani supports model selection through its configuration or its `/model` command. The product owner must approve the exact provider, model, and usage budget.

Add Omera mode to `$XAVANI_HOME/config.yaml`:

    platforms:
      api_server:
        enabled: true
        extra:
          omera_mode: true

Start the Xavani API server:

    xavani gateway

The local Xavani API server uses `http://127.0.0.1:8642/` by default. Omera adds `/v1/capabilities` and `/v1/chat/completions` to this origin.

`API_SERVER_KEY` authenticates Omera to Xavani. The provider key authenticates Xavani to the AI provider. These keys have different purposes.

## 5. Configure Omera

Open the Omera repository. Copy `.env.example` to `.env.local` only if `.env.local` does not exist. Edit the local file with the real values.

For local use, set these values:

    APP_ORIGIN=http://127.0.0.1:3000
    OMERA_DEMO_MODE=false
    XAVANI_BASE_URL=http://127.0.0.1:8642/
    XAVANI_API_KEY=<same value as API_SERVER_KEY>
    XAVANI_MODEL=omera
    SUPABASE_URL=<Supabase project URL>
    SUPABASE_SERVICE_ROLE_KEY=<Supabase service role key>
    NEXT_PUBLIC_SUPABASE_URL=<same Supabase project URL>
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon key>
    LELAPA_API_KEY=<Lelapa key, if voice is required>

`XAVANI_MODEL=omera` is the service alias. It is not the underlying AI model name. Xavani selects the underlying model from its own configuration.

`XAVANI_API_KEY` must match `API_SERVER_KEY`. Never put the provider key in `XAVANI_API_KEY`.

Keep `.env.local` on the local computer. Do not commit it. Do not add secrets to any `NEXT_PUBLIC_` variable.

## 6. Start the local app

Run these commands from the Omera repository root:

    export PATH="$PWD/.local/node-v24.21.0-darwin-arm64/bin:$PATH"
    npm ci
    npm run dev

Open this address:

    http://127.0.0.1:3000

Sign in with the email code. Send a typed chat request. Open Form fill to upload a permitted PDF, answer fields, review the result, and download the completed PDF.

Voice input needs `LELAPA_API_KEY`. The current voice matrix supports `eng` and `zul`. It marks `afr` and `sot` as beta. It does not support the other 7 languages for voice.

## 7. Verify each service

Open this health endpoint:

    http://127.0.0.1:3000/api/health

A configured status does not prove that Xavani can return a complete answer. Sign in and send a real chat request to test inference.

Run the local code checks:

    npm run typecheck
    npm run test -- --maxWorkers=1
    npm run lint
    npm run build

Run a staging smoke test only after you obtain an approved target URL:

    node scripts/smoke.mjs --target <staging URL>

A paid model call needs explicit budget approval. Use the script's paid option only after the product owner approves the spend.

## 8. Set up production

Do not use `127.0.0.1` as the production Xavani address. A hosted Omera server cannot reach a developer computer through its own loopback address.

Deploy Xavani on a secured host that the Omera server can reach over HTTPS. Do not expose the API server port directly to the public internet. Use network restrictions, TLS, and the service key.

Set production environment variables in the hosting provider's secret settings. Set `APP_ORIGIN` to the exact production origin. Set `XAVANI_BASE_URL` to the Xavani HTTPS origin without a `/v1` suffix. Set the production Supabase Auth site and redirect URLs to the approved domain.

Obtain product owner approval before production deployment, production migrations, or paid provider calls. The old Vercel URL in `XAVANI-INSTRUCTIONS.md` does not prove that a current deployment works.

## 9. Inputs that still need owner approval

- The dedicated Supabase project and its region.
- The Xavani host, provider, actual model, provider key, and usage budget.
- The Lelapa key if the product requires voice input.
- The production domain and deployment approval.
- Data retention, processor, and cross-border data decisions.
- 3 real forms with permission to test them.
- Consented language recordings and qualified reviewers.

Do not mark these items complete until an operator verifies them. Do not claim full 11-language voice support. Do not claim live model quality until the operator tests the selected model.