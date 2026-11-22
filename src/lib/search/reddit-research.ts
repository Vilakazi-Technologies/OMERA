import "server-only";

/** Public Reddit mirror. No key needed. Data is a cached snapshot, not live. */
const PULLPUSH_BASE = "https://api.pullpush.io/reddit/search";

export const REDDIT_RESEARCH_TIMEOUT_MS = 10000;
export const REDDIT_MAX_ITEMS = 6;
const EXCERPT_MAX = 480;

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "what", "how",
  "why", "are", "was", "you", "your", "does", "about", "into", "help",
]);

export type RedditResearchItem = {
  kind: "post" | "comment";
  title: string;
  excerpt: string;
  url: string;
  subreddit: string;
  score: number;
  createdUtc: number;
  scrapedUtc?: number;
};

function redditTimeoutMs(env: NodeJS.ProcessEnv): number {
  const raw = env.REDDIT_SEARCH_MAX_WAIT_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : REDDIT_RESEARCH_TIMEOUT_MS;
  if (!Number.isFinite(parsed) || parsed < 2000) return REDDIT_RESEARCH_TIMEOUT_MS;
  return Math.min(15000, parsed);
}

function termsFor(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    .slice(0, 8);
}

function isRelevant(text: string, terms: string[]): boolean {
  if (!terms.length) return true;
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function cleanText(value: unknown, max = EXCERPT_MAX): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_>#`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function redditUrl(item: Record<string, unknown>, fallbackId: string): string {
  const permalink = item.permalink;
  if (typeof permalink === "string" && permalink.startsWith("/")) {
    return `https://www.reddit.com${permalink}`;
  }
  const link = item.link_id;
  if (typeof link === "string" && link.startsWith("t3_")) {
    return `https://www.reddit.com/comments/${link.slice(3)}`;
  }
  return `https://www.reddit.com/comments/${fallbackId}`;
}

async function fetchRows(
  kind: "submission" | "comment",
  query: string,
  signal: AbortSignal,
): Promise<Record<string, unknown>[]> {
  const url = new URL(`${PULLPUSH_BASE}/${kind}/`);
  url.searchParams.set("q", query);
  url.searchParams.set("size", "5");
  url.searchParams.set("sort", "desc");
  url.searchParams.set("sort_type", "score");
  try {
    const response = await fetch(url, {
      signal,
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      return [];
    }
    const data = (await response.json()) as { data?: unknown };
    if (!Array.isArray(data.data)) return [];
    return data.data.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row),
    );
  } catch {
    return [];
  }
}

function toItem(
  row: Record<string, unknown>,
  kind: "post" | "comment",
): RedditResearchItem | null {
  const id = typeof row.id === "string" ? row.id : "";
  const subreddit = typeof row.subreddit === "string" ? row.subreddit : "";
  const body = cleanText(row.selftext ?? row.body ?? "");
  const title = cleanText(row.title ?? (kind === "comment" ? body : ""), 180);
  if (!body && !title) return null;
  const meta = row._meta;
  const scrapedUtc =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? (meta as Record<string, unknown>).pullpush_scrape_utc
      : undefined;
  return {
    kind,
    title: title || body.slice(0, 120),
    excerpt: body || "See the linked discussion.",
    url: redditUrl(row, id),
    subreddit: subreddit || "reddit",
    score: typeof row.score === "number" ? row.score : 0,
    createdUtc:
      typeof row.created_utc === "number"
        ? row.created_utc
        : Date.now() / 1000,
    scrapedUtc: typeof scrapedUtc === "number" ? scrapedUtc : undefined,
  };
}

/** Fetches Reddit posts and comments. Returns [] when the mirror is unavailable. */
export async function fetchRedditResearch(
  query: string,
  requestSignal?: AbortSignal,
  env: NodeJS.ProcessEnv = process.env,
): Promise<RedditResearchItem[]> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 200);
  if (q.length < 3) return [];
  const terms = termsFor(q);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), redditTimeoutMs(env));
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, controller.signal])
    : controller.signal;
  try {
    const [posts, comments] = await Promise.all([
      fetchRows("submission", q, signal),
      fetchRows("comment", q, signal),
    ]);
    const seen = new Set<string>();
    const items: RedditResearchItem[] = [];
    for (const [rows, kind] of [
      [posts, "post"] as const,
      [comments, "comment"] as const,
    ]) {
      for (const row of rows) {
        const text = `${row.title ?? ""} ${row.selftext ?? row.body ?? ""}`;
        if (!isRelevant(text, terms)) continue;
        const item = toItem(row, kind);
        if (!item || seen.has(item.url)) continue;
        seen.add(item.url);
        items.push(item);
        if (items.length >= REDDIT_MAX_ITEMS) break;
      }
    }
    return items.sort((a, b) => b.score - a.score).slice(0, REDDIT_MAX_ITEMS);
  } finally {
    clearTimeout(timer);
  }
}

function stamp(epoch: number | undefined): string {
  if (!epoch || !Number.isFinite(epoch)) return "date unknown";
  return new Date(epoch * 1000).toISOString().slice(0, 10);
}

/**
 * Formats a Reddit block with an explicit cached-data warning.
 * The model must never present this block as live or verified fact.
 */
export function formatRedditResearchContext(
  items: RedditResearchItem[],
  retrievedAtIso: string,
): string {
  if (!items.length) return "";
  const lines = items.map(
    (item, index) =>
      `${index + 1}. **${item.kind === "post" ? "Post" : "Comment"} in r/${item.subreddit}** (score ${item.score}, posted ${stamp(item.createdUtc)}, archived ${stamp(item.scrapedUtc)})\n   ${item.title}\n   ${item.excerpt}\n   URL: ${item.url}`,
  );
  return `## Reddit community research (public mirror)\nRetrieved ${retrievedAtIso}. This is a cached archive snapshot, not live Reddit. Posts may be days or weeks old. Treat these as personal opinions and anecdotes, not verified facts. Do not present them as current events.\n\n${lines.join("\n\n")}`;
}
