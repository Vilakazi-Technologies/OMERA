import { expect, it } from "vitest";
import { integrationTarget } from "./setup";

it("uses the validated integration target", () => {
  const suppliedTarget = process.env.OMERA_INTEGRATION_SUPABASE_URL;
  expect(suppliedTarget).toBeDefined();
  expect(integrationTarget).toBe(new URL(suppliedTarget ?? "").href);
});
