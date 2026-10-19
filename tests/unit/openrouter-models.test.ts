import { describe, expect, it } from "vitest";
import {
  OPENROUTER_PRIMARY_MODEL,
  resolveOpenRouterModelId,
} from "@/lib/ai/openrouter-models";

describe("resolveOpenRouterModelId", () => {
  it("uses the primary model when env is empty", () => {
    expect(resolveOpenRouterModelId({})).toBe(OPENROUTER_PRIMARY_MODEL);
  });

  it("remaps retired Gemini 2.0 flash lite free slug", () => {
    expect(
      resolveOpenRouterModelId({
        OPENROUTER_MODEL: "google/gemini-2.0-flash-lite-preview-02-05:free",
      }),
    ).toBe(OPENROUTER_PRIMARY_MODEL);
  });

  it("keeps a custom configured model", () => {
    expect(
      resolveOpenRouterModelId({
        OPENROUTER_MODEL: "openai/gpt-4o-mini",
      }),
    ).toBe("openai/gpt-4o-mini");
  });
});
