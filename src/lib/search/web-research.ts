import "server-only";
import {
  googleCustomSearch,
  isGoogleWebSearchConfigured,
  type GoogleSearchHit,
} from "@/lib/search/google-custom-search";

export const WEB_RESEARCH_INSTRUCTIONS = `Omera runs Google Custom Search on the server before this reply.
When a "Google web search" section appears below, you MUST treat it as live web research already done for the user.
Use those snippets and URLs for facts. Cite sources as markdown links.
NEVER say you cannot browse the web, lack real-time access, or are "only trained on data" when this section is present.
If results are empty or marked failed, answer from what you know about the topic, state that live search returned no usable hits, and do not lecture the user about AI training limits.`;

export function shouldResearchOnGoogle(userMessage: string): boolean {
  const text = userMessage.trim();
  if (text.length < 4) return false;
  if (
    /^(hi|hello|hey|thanks|thank you|ok|okay|cool|great)\b[!.,?\s]*$/i.test(
      text,
    )
  ) {
    return false;
  }
  if (
    /\b(google|search the web|search online|look up|look online|find out about|browse the web|on the internet)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return text.length >= 6;
}

const QUERY_PREFIX =
  /^(?:please\s+)?(?:(?:can|could)\s+you\s+)?(?:(?:the\s+)?ai\s+)?(?:must\s+)?(?:google|search(?:\s+the\s+web|\s+online)?|look\s+up)\s+(?:for\s+)?/i;

export function buildGoogleSearchQuery(userMessage: string): string {
  let q = userMessage.trim().split(/\n/)[0]?.trim() ?? "";
  q = q.replace(QUERY_PREFIX, "");
  q = q.replace(/\b(?:please|thanks|thank you)\.?$/i, "").trim();
  q = q.replace(/\s+/g, " ").slice(0, 256);
  if (q.length >= 3) return q;

  const brand = userMessage.match(
    /\b(vilatech|vilakazi|omera|cipc|sars)\b/i,
  )?.[0];
  return brand ?? userMessage.trim().slice(0, 120);
}

export function formatWebResearchContext(
  query: string,
  hits: GoogleSearchHit[],
  queriedAtIso: string,
  status: "ok" | "empty" | "failed" = hits.length ? "ok" : "empty",
): string {
  const safeQuery = query.replace(/"/g, "'");
  if (status === "failed") {
    return `${WEB_RESEARCH_INSTRUCTIONS}

## Google web search
Query: "${safeQuery}" (attempted ${queriedAtIso})
Status: search request failed (configuration, quota, or timeout).
Tell the user Omera attempted Google research but could not fetch results this time. Answer from general knowledge about the topic without claiming you cannot ever search the web.`;
  }
  if (hits.length === 0) {
    return `${WEB_RESEARCH_INSTRUCTIONS}

## Google web search
Query: "${safeQuery}" (retrieved ${queriedAtIso})
Status: no results returned for this query.
Summarize what you know about the topic (e.g. VILATECH as the company behind Omera) and suggest the user check official sites. Do not claim you lack internet access.`;
  }
  const lines = hits.map(
    (hit, index) =>
      `${index + 1}. **${hit.title}**\n   ${hit.snippet}\n   URL: ${hit.link}`,
  );
  return `${WEB_RESEARCH_INSTRUCTIONS}

## Google web search
Query: "${safeQuery}" (retrieved ${queriedAtIso})

${lines.join("\n\n")}`;
}

async function runSearchWithFallbacks(
  userMessage: string,
  signal?: AbortSignal,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ query: string; hits: GoogleSearchHit[]; status: "ok" | "empty" | "failed" }> {
  const primary = buildGoogleSearchQuery(userMessage);
  const queries = [primary];
  const brand = userMessage.match(/\b(vilatech|vilakazi)\b/i)?.[0];
  if (brand) {
    if (primary.toLowerCase() !== brand.toLowerCase()) {
      queries.push(brand);
    }
    queries.push(`${brand} South Africa`);
  }

  let lastError = false;
  const seen = new Set<string>();
  for (const query of queries) {
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const hits = await googleCustomSearch(query, signal, env);
      if (hits.length > 0) {
        return { query, hits, status: "ok" };
      }
    } catch {
      lastError = true;
    }
  }
  return {
    query: primary,
    hits: [],
    status: lastError ? "failed" : "empty",
  };
}

export async function buildWebResearchSystemContext(
  userMessage: string,
  signal?: AbortSignal,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  if (!isGoogleWebSearchConfigured(env)) return null;
  if (!shouldResearchOnGoogle(userMessage)) return null;

  const { query, hits, status } = await runSearchWithFallbacks(
    userMessage,
    signal,
    env,
  );
  const queriedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  return formatWebResearchContext(query, hits, queriedAt, status);
}

function researchWaitMs(env: NodeJS.ProcessEnv): number {
  const raw = env.GOOGLE_SEARCH_MAX_WAIT_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 6000;
  if (!Number.isFinite(parsed) || parsed < 500) return 6000;
  return Math.min(12000, parsed);
}

/** Caps Google latency so chat still streams if search is slow (demo-friendly). */
export async function buildWebResearchSystemContextBounded(
  userMessage: string,
  requestSignal?: AbortSignal,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  if (!isGoogleWebSearchConfigured(env)) return null;
  if (!shouldResearchOnGoogle(userMessage)) return null;

  const budgetMs = researchWaitMs(env);
  const controller = new AbortController();
  const abort = () => controller.abort();
  requestSignal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, budgetMs);
  try {
    return await buildWebResearchSystemContext(
      userMessage,
      controller.signal,
      env,
    );
  } catch {
    const queriedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    return formatWebResearchContext(
      buildGoogleSearchQuery(userMessage),
      [],
      queriedAt,
      "failed",
    );
  } finally {
    clearTimeout(timer);
    requestSignal?.removeEventListener("abort", abort);
  }
}
