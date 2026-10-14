import { expect, it } from "vitest";
import { SA_LANGUAGES } from "@/lib/languages";

it("loads the existing language registry", () => {
  expect(new Set(SA_LANGUAGES.map((language) => language.id)).size).toBe(11);
});
