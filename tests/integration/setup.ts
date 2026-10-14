import { validateIntegrationTarget } from "./target";

// Validate both inputs before a database client can start.
export const integrationTarget = validateIntegrationTarget(
  process.env.OMERA_PRODUCTION_SUPABASE_URL,
  process.env.OMERA_INTEGRATION_SUPABASE_URL,
);
