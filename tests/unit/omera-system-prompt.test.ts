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

it("keeps name, language, and business facts private unless asked", () => {
  const prompt = buildOmeraSystemPrompt("zul", "What you remember about this person\nName: Ayanda");
  expect(prompt).toContain("private memory");
  expect(prompt).toContain("Never recite their name, chosen language, or stored business facts");
  expect(prompt).toContain("unless they explicitly ask");
  expect(prompt).toContain("what's my name");
  expect(prompt).toContain("what do you know about my business");
  expect(prompt).toContain("Do not announce that you remember them");
  expect(prompt).toContain("Do not open with their name");
  expect(prompt).toContain("Do not list facts back unprompted");
  expect(prompt).toContain("answer the question they just asked");
  expect(prompt).not.toContain("Do not recite it back unless it helps");
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
