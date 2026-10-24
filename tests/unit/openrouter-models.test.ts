import { describe, expect, it } from "vitest";
import {
  OPENROUTER_PRIMARY_MODEL,
  openRouterModelChain,
  resolveOpenRouterModelId,
} from "@/lib/ai/openrouter-models";

describe("resolveOpenRouterModelId", () => {
  it("uses the primary model when env is empty", () => {
    expect(resolveOpenRouterModelId({ NODE_ENV: "test" })).toBe(OPENROUTER_PRIMARY_MODEL);
  });

  it("remaps retired Gemini 2.0 flash lite free slug", () => {
    expect(
      resolveOpenRouterModelId({
        NODE_ENV: "test",
        OPENROUTER_MODEL: "google/gemini-2.0-flash-lite-preview-02-05:free",
      }),
    ).toBe(OPENROUTER_PRIMARY_MODEL);
  });

  it("keeps a custom configured model", () => {
    expect(
      resolveOpenRouterModelId({
        NODE_ENV: "test",
        OPENROUTER_MODEL: "openai/gpt-4o-mini",
      }),
    ).toBe("openai/gpt-4o-mini");
  });
});

describe("openRouterModelChain", () => {
  it("puts the primary first and dedupes fallbacks", () => {
    const chain = openRouterModelChain("openai/gpt-4o-mini", {
      NODE_ENV: "test",
      OPENROUTER_FALLBACK_MODELS: "google/gemini-2.5-flash-lite,openai/gpt-4o-mini",
    });
    expect(chain[0]).toBe("openai/gpt-4o-mini");
    expect(chain.includes(OPENROUTER_PRIMARY_MODEL)).toBe(true);
    expect(chain.length).toBeLessThanOrEqual(5);
  });
});
