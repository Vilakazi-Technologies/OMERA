import "server-only";
import {
  googleCustomSearch,
  isGoogleWebSearchConfigured,
  type GoogleSearchHit,
} from "@/lib/search/google-custom-search";

export const WEB_RESEARCH_INSTRUCTIONS = `You may receive a "Google web search" section with fresh results.
Use it for current facts: news, prices, regulations, fees, dates, and named entities.
Cite sources as markdown links using the URLs provided.
If results are empty or irrelevant, say what you could not verify online and answer from general knowledge with clear uncertainty.`;

export function shouldResearchOnGoogle(userMessage: string): boolean {
  const text = userMessage.trim();
  if (text.length < 6) return false;
  if (
    /^(hi|hello|hey|thanks|thank you|ok|okay|cool|great)\b[!.,?\s]*$/i.test(
      text,
    )
  ) {
    return false;
  }
  return true;
}

export function buildGoogleSearchQuery(userMessage: string): string {
  const firstLine = userMessage.trim().split(/\n/)[0]?.trim() ?? "";
  return firstLine.replace(/\s+/g, " ").slice(0, 256);
}

export function formatWebResearchContext(
  query: string,
  hits: GoogleSearchHit[],
  queriedAtIso: string,
): string | null {
  if (hits.length === 0) return null;
  const lines = hits.map(
    (hit, index) =>
      `${index + 1}. **${hit.title}**\n   ${hit.snippet}\n   URL: ${hit.link}`,
  );
  return `${WEB_RESEARCH_INSTRUCTIONS}

## Google web search
Query: "${query.replace(/"/g, "'")}" (retrieved ${queriedAtIso})

${lines.join("\n\n")}`;
}

export async function buildWebResearchSystemContext(
  userMessage: string,
  signal?: AbortSignal,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  if (!isGoogleWebSearchConfigured(env)) return null;
  if (!shouldResearchOnGoogle(userMessage)) return null;

  const query = buildGoogleSearchQuery(userMessage);
  const hits = await googleCustomSearch(query, signal, env);
  const queriedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  return formatWebResearchContext(query, hits, queriedAt);
}
