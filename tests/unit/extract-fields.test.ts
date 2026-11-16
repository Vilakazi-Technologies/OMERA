import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/chat-runtime", () => ({
  completeConfiguredJson: vi.fn(),
}));
import { completeConfiguredJson } from "@/lib/ai/chat-runtime";
import { extractFormFields } from "@/lib/forms/extract-fields";
import type { PdfFieldInfo } from "@/lib/forms/pdf-fields";

const INSPECTED: PdfFieldInfo[] = [
  { id: "full_name", kind: "text", required: true, initialValue: "" },
  { id: "permission", kind: "checkbox", required: false, initialValue: false },
  {
    id: "method",
    kind: "choice",
    required: false,
    initialValue: "",
    options: ["Email", "Phone"],
  },
];

it("a_failed_analysis_falls_back_to_humanized_labels", async () => {
  vi.mocked(completeConfiguredJson).mockImplementationOnce(
    async (_system, _input, parse) =>
      parse({
        fields: [
          { id: "full_name", label: "Igama", prompt: "Ngubani igama lakho?" },
        ],
      } as never),
  );
  const fields = await extractFormFields(INSPECTED, {
    languageId: "zul",
  });
  expect(fields.map((field) => field.id).sort()).toEqual(
    ["full_name", "method", "permission"].sort(),
  );
  expect(fields.find((field) => field.id === "full_name")?.label).toBe(
    "Full name",
  );
});

it("translated_prompts_keep_the_canonical_field_names", async () => {
  vi.mocked(completeConfiguredJson).mockImplementationOnce(
    async (_system, _input, parse) =>
      parse({
        fields: [
          { id: "full_name", label: "Igama eliphelele", prompt: "Ngubani igama lakho eliphelele?" },
          { id: "permission", label: "Imvume", prompt: "Uyavuma yini?" },
          {
            id: "method",
            label: "Indlela yokuxhumana",
            prompt: "Sikuxhumane kanjani?",
            options: ["Email", "Phone"],
          },
        ],
      } as never),
  );
  const fields = await extractFormFields(INSPECTED, { languageId: "zul" });
  expect(fields.map((field) => field.id)).toEqual([
    "full_name",
    "method",
    "permission",
  ]);
  expect(fields[0]).toMatchObject({
    label: "Igama eliphelele",
    prompt: "Ngubani igama lakho eliphelele?",
  });
  expect(fields.find((field) => field.id === "method")).toStrictEqual({
    id: "method",
    label: "Indlela yokuxhumana",
    type: "text",
    required: false,
    prompt: "Sikuxhumane kanjani?",
    kind: "choice",
    options: ["Email", "Phone"],
  });
});

it("uses_humanized_fallback_when_ai_is_unavailable", async () => {
  vi.mocked(completeConfiguredJson)
    .mockRejectedValueOnce(new Error("CHAT_UNAVAILABLE"))
    .mockRejectedValueOnce(new Error("CHAT_UNAVAILABLE"));
  const fields = await extractFormFields(INSPECTED, { languageId: "zul" });
  expect(fields[0].id).toBe("full_name");
  expect(fields[0].label).toBe("Full name");
  expect(fields[0].prompt.toLowerCase()).toContain("full name");
});
