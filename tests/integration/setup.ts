import { vi } from "vitest";

// Server-only modules (Supabase admin, identity mapping) throw outside the
// Next.js runtime. Mock it here so every integration file that imports this
// setup first gets the mock before those modules evaluate.
vi.mock("server-only", () => ({}));

import { validateIntegrationTarget } from "./target";

// Validate both inputs before a database client can start.
export const integrationTarget = validateIntegrationTarget(
  process.env.OMERA_PRODUCTION_SUPABASE_URL,
  process.env.OMERA_INTEGRATION_SUPABASE_URL,
);
