/** Client-safe types (no server-only imports). */
export type ModelCatalogEntry = {
  id: string;
  label: string;
  kind: "primary" | "extension";
  available: boolean;
  description?: string;
};

export const OMERA_MODEL_ID = "omera";
