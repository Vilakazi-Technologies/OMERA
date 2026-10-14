import { expect, it } from "vitest";
import { preserveAnswer } from "@/lib/forms/answers";

it("preserves names and identifiers without inference", () => {
  expect(preserveAnswer("  Jean-Pierre van der Merwe  ")).toBe("Jean-Pierre van der Merwe");
  expect(preserveAnswer("Ṱhendo Muḓau")).toBe("Ṱhendo Muḓau");
  expect(preserveAnswer("001234")).toBe("001234");
  expect(preserveAnswer("+27 82 123 4567")).toBe("+27 82 123 4567");
  expect(preserveAnswer("a.b+work@example.test")).toBe("a.b+work@example.test");
});

it.each([
  ["", ""],
  [" \t\r\n\u00a0", ""],
  ["\t  Alice  \r\n", "Alice"],
  ["\u00a0Ṱhendo Muḓau\u00a0", "Ṱhendo Muḓau"],
  ["Jean  Pierre", "Jean  Pierre"],
  ["Line 1\nLine 2\tUnit 3", "Line 1\nLine 2\tUnit 3"],
  ["A\u00a0B", "A\u00a0B"],
  ["e\u0301", "e\u0301"],
  ["é", "é"],
  ["１２３", "１２３"],
  ["ABC-001", "ABC-001"],
  ["01/02/2026", "01/02/2026"],
  ["1,000.00", "1,000.00"],
  ["O'Connor-Smith", "O'Connor-Smith"],
  ["Answer: John", "Answer: John"],
  ["__proto__", "__proto__"],
  ["🗣️ Sawubona", "🗣️ Sawubona"],
])("trims only the outer whitespace in %j", (input, expected) => {
  expect(preserveAnswer(input)).toBe(expected);
});
