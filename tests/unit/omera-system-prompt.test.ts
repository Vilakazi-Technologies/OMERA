import { expect, it } from "vitest";
import { buildOmeraSystemPrompt } from "@/lib/ai/omera-system-prompt";
import { SA_LANGUAGES } from "@/lib/languages";

it("builds the business and reply-language instructions", () => {
  const automatic = buildOmeraSystemPrompt(null);
  expect(automatic).toContain("business adviser");
  expect(automatic).toContain("Ask for currency and time horizon");
  expect(automatic).toContain("goals, not guarantees");
  expect(automatic).toContain("Otherwise, reply in the language of the latest user message.");
  expect(automatic).toContain("Ask for a language preference if that message is ambiguous.");
  for (const language of SA_LANGUAGES) {
    expect(buildOmeraSystemPrompt(language.id))
      .toContain(`Reply entirely in ${language.nativeName}`);
  }
  expect(() => buildOmeraSystemPrompt("invalid")).toThrow("INVALID_LANGUAGE");
});

it("forbids corporate filler and bullet essays", () => {
  const prompt = buildOmeraSystemPrompt(null);
  expect(prompt).toContain('Never open with "Certainly"');
  expect(prompt).toContain("I'd be happy to");
  expect(prompt).toContain("Do not answer with a bullet list unless they asked");
  expect(prompt).toContain("Talk like a person");
  expect(prompt).toContain("isiZulu");
  expect(prompt).toContain("siSwati");
  expect(prompt).not.toContain("organize the answer into current situation");
  expect(prompt).not.toContain("Keep the tone professional");
});
