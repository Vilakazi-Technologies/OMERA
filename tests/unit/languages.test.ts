import { describe, expect, it } from "vitest";
import { SA_LANGUAGES } from "@/lib/languages";
import { buildOmeraSystemPrompt } from "@/lib/ai/omera-system-prompt";

const CODES = ["eng", "afr", "zul", "xho", "nso", "sot", "tsn", "ssw", "ven", "tso", "nbl"];

describe("eleven official languages", () => {
  it("registers all eleven codes once", () => {
    expect(SA_LANGUAGES.map((language) => language.id).sort()).toEqual([...CODES].sort());
  });

  it("instructs the model to answer in each language", () => {
    for (const code of CODES) {
      const language = SA_LANGUAGES.find((item) => item.id === code);
      expect(language).toBeDefined();
      const prompt = buildOmeraSystemPrompt(code, null);
      expect(prompt).toContain(`Reply entirely in ${language!.nativeName}`);
    }
  });

  it("rejects an unknown language", () => {
    expect(() => buildOmeraSystemPrompt("xxx", null)).toThrow("INVALID_LANGUAGE");
  });
});
