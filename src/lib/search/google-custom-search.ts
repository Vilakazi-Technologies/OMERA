import "server-only";

export type GoogleSearchHit = {
  title: string;
  link: string;
  snippet: string;
};

function engineId(env: NodeJS.ProcessEnv): string | null {
  const id =
    env.GOOGLE_SEARCH_ENGINE_ID?.trim() || env.GOOGLE_CSE_ID?.trim() || "";
  return id || null;
}

export function isGoogleWebSearchConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.GOOGLE_SEARCH_API_KEY?.trim() && engineId(env));
}

function resultLimit(env: NodeJS.ProcessEnv): number {
  const raw = env.GOOGLE_SEARCH_NUM_RESULTS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 6;
  if (!Number.isFinite(parsed) || parsed < 1) return 6;
  return Math.min(10, parsed);
}

export async function googleCustomSearch(
  query: string,
  signal?: AbortSignal,
  env: NodeJS.ProcessEnv = process.env,
): Promise<GoogleSearchHit[]> {
  const apiKey = env.GOOGLE_SEARCH_API_KEY?.trim();
  const cx = engineId(env);
  if (!apiKey || !cx) return [];

  const q = query.trim().replace(/\s+/g, " ").slice(0, 256);
  if (!q) return [];

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", q);
  url.searchParams.set("num", String(resultLimit(env)));
  url.searchParams.set("safe", "active");

  const response = await fetch(url, {
    method: "GET",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
      : AbortSignal.timeout(12000),
    redirect: "error",
    cache: "no-store",
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("GOOGLE_SEARCH_FAILED");
  }

  const data = (await response.json()) as {
    items?: { title?: string; link?: string; snippet?: string }[];
  };

  const items = data.items ?? [];
  const hits: GoogleSearchHit[] = [];
  for (const item of items) {
    const title = item.title?.trim();
    const link = item.link?.trim();
    const snippet = item.snippet?.trim() ?? "";
    if (!title || !link) continue;
    if (!/^https?:\/\//i.test(link)) continue;
    hits.push({ title, link, snippet });
  }
  return hits;
}
