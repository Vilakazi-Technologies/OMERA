import { expect, it } from "vitest";
import { buildOmeraSystemPrompt } from "@/lib/ai/omera-system-prompt";
import { SA_LANGUAGES } from "@/lib/languages";

it("builds the business and reply-language instructions", () => {
  const automatic = buildOmeraSystemPrompt(null);
  expect(automatic).toContain("business adviser");
  expect(automatic).toContain("Ask for currency and time horizon");
  expect(automatic).toContain("goals, not guarantees");
  expect(automatic).toContain("latest user message");
  for (const language of SA_LANGUAGES) {
    expect(buildOmeraSystemPrompt(language.id))
      .toContain(`Otherwise, reply in ${language.nativeName}.`);
  }
  expect(() => buildOmeraSystemPrompt("invalid")).toThrow("INVALID_LANGUAGE");
});
