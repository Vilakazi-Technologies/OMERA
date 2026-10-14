import { expect, it } from "vitest";
import { runtimeMode } from "@/lib/ai/runtime-mode";

it("requires an explicit non-production demo mode", () => {
  expect(runtimeMode(undefined, {})).toBe("unavailable");
  expect(runtimeMode("  ", { NODE_ENV: "production", OMERA_DEMO_MODE: "true" }))
    .toBe("unavailable");
  expect(runtimeMode(undefined, { NODE_ENV: "development", OMERA_DEMO_MODE: "true" }))
    .toBe("demo");
  expect(runtimeMode("test-key", { NODE_ENV: "development", OMERA_DEMO_MODE: "true" }))
    .toBe("live");
});
