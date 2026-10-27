/** Default when env is unset or points at a retired OpenRouter slug. */
export const OPENROUTER_PRIMARY_MODEL = "google/gemini-2.5-flash-lite";

/** Models removed from OpenRouter or shut down by providers. */
const RETIRED_OPENROUTER_MODELS = new Set([
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "google/gemini-2.0-flash-lite-preview-02-05",
]);

export function resolveOpenRouterModelId(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.OPENROUTER_MODEL?.trim();
  if (!configured) return OPENROUTER_PRIMARY_MODEL;
  if (RETIRED_OPENROUTER_MODELS.has(configured)) return OPENROUTER_PRIMARY_MODEL;
  return configured;
}

/** Vision (skin scan) — defaults to chat model; override with OPENROUTER_VISION_MODEL. */
export function resolveOpenRouterVisionModelId(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.OPENROUTER_VISION_MODEL?.trim();
  if (configured && !RETIRED_OPENROUTER_MODELS.has(configured)) return configured;
  return resolveOpenRouterModelId(env);
}

/** Fast, low-cost models OpenRouter can fall back to when the primary is busy. */
const DEFAULT_OPENROUTER_FALLBACKS = [
  OPENROUTER_PRIMARY_MODEL,
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.2-3b-instruct:free",
] as const;

/** Ordered model list for OpenRouter `models` (primary first, max 5). */
export function openRouterModelChain(
  primary: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const fromEnv =
    env.OPENROUTER_FALLBACK_MODELS?.split(",")
      .map((slug) => slug.trim())
      .filter(Boolean) ?? [];
  const chain = [primary, ...fromEnv, ...DEFAULT_OPENROUTER_FALLBACKS];
  const unique: string[] = [];
  for (const slug of chain) {
    if (!unique.includes(slug)) unique.push(slug);
  }
  return unique.slice(0, 5);
}
