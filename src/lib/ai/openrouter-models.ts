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
