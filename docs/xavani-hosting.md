# Xavani hosting and operation

Omera talks to one Xavani service. This page records where it runs, how it
fails, and how to recover it.

## What runs where

- Omera: Next.js on Vercel, project `vilatech-ai`.
- Xavani: the `xavani_omera` service on Render, project `xavani-omera`.
- Model: optional. The service runs without a key.

Origin shape: `https://xavani-omera.onrender.com`.

## Modes

`GET /health` reports the current mode.

- `model`: `INFERENCE_API_KEY` and `INFERENCE_MODEL` are set. Replies come from
  the model. The current target is the Gemini OpenAI-compatible endpoint.
- `keyless`: `KEYLESS_MODEL=on`. A no-key endpoint answers. It allows about one
  reply every 30 seconds per IP, so a shared host can hit the limit. Off by
  default.
- `research`: no model. The answer is assembled from live sources and cites
  them. This is the default and the fallback.

A keyless failure pauses that path for 120 seconds. The next request answers in
about 2 seconds from research.

## Search chain

Order: `tavily`, `exa`, `ddgs`, `bing`.

- Tavily and Exa need free keys. They return page text with the results.
- DuckDuckGo and Bing need no key. Bing is the reliable fallback.
- Each backend has an 8-second hard limit.
- Results are cached for 15 minutes.
- Page fetches use a 6-second timeout, a 1.5 MB cap, and a private-address guard.
- Jina Reader runs when a page returns fewer than 400 characters of text.

## Omera environment

Set these on the `vilatech-ai` Vercel project, then redeploy.

```
XAVANI_BASE_URL=https://xavani-omera.onrender.com
XAVANI_API_KEY=<the API_SERVER_KEY from the Render service>
XAVANI_MODEL=omera
```

Verify:

```bash
curl -s https://vilatech-ai.vercel.app/api/health | python3 -m json.tool
```

`chat.provider` must be `xavani`.

Omera skips its own Google search when the Xavani capability block advertises
research. It keeps the Google path as a fallback for OpenRouter.

## Deploy

```bash
cd ~/xavani-agent
git push origin feat/omera-api-mode
```

Render dashboard, `xavani-omera`, `Manual Deploy`, `Deploy latest commit`.

## Inspect

- Render dashboard, `Logs`.
- `curl -s https://xavani-omera.onrender.com/health`
- `curl -s -o /dev/null -w "%{http_code}\n" https://xavani-omera.onrender.com/v1/capabilities`

## Rotate the service key

1. Set `API_SERVER_KEY_PREVIOUS` to the current key.
2. Set `API_SERVER_KEY` to the new key.
3. Deploy.
4. Update `XAVANI_API_KEY` in Vercel and redeploy Omera.
5. After 24 hours, clear `API_SERVER_KEY_PREVIOUS`.

Both keys work during the switch, so no request fails.

## Incident: replies fail

1. `curl -s https://xavani-omera.onrender.com/health`.
2. If the body is missing, the service slept or crashed. Wait 60 seconds and
   retry. The first request after a sleep is slow.
3. Open Render logs. `search_failed` names the backend that failed.
   `inference_failed` names the model that failed.
4. If the service is healthy but replies fail, check Omera:
   `curl -s https://vilatech-ai.vercel.app/api/health`.

## Quotas

- Render free: 750 instance-hours per month. An always-awake month uses 720 to
  744. Keep one service per workspace.
- Render free sleeps after 15 minutes without traffic. UptimeRobot pings
  `/health` every 5 minutes, which keeps it awake.
- Tavily: 1,000 credits per month. Exa: $10 monthly credit. Both optional.
- Gemini free tier: daily request caps. The fallback model has a higher cap.

## Upgrade path

When funding lands, move the same package to Fly with two machines. The earlier
plan holds the container, health checks, and drills. The application code does
not change.
