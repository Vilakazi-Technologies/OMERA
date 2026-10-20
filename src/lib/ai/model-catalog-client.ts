/** Client-safe types (no server-only imports). */
export type ModelCatalogEntry = {
  id: string;
  label: string;
  kind: "primary" | "extension";
  available: boolean;
  description?: string;
};

export const OMERA_MODEL_ID = "omera";

/** Last-resort OpenRouter slug when automatic retries need a fast free model. */
export const OPENROUTER_DEMO_FALLBACK_MODEL_ID = "google/gemini-2.5-flash-lite";
