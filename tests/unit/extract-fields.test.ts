import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/xavani-client", () => ({
  completeXavaniJson: vi.fn(),
  getXavaniConfig: vi.fn(() => ({
    baseUrl: "https://xavani.example",
    apiKey: "test-key",
    model: "omera",
  })),
}));
import { completeXavaniJson } from "@/lib/ai/xavani-client";
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

it("a_failed_analysis_returns_no_demo_fields", async () => {
  vi.mocked(completeXavaniJson).mockResolvedValueOnce([
    { id: "full_name", label: "Igama", prompt: "Ngubani igama lakho?" },
    // permission and method omitted: strict coverage must reject, never demo.
  ] as never);
  const error = await extractFormFields(INSPECTED, {
    languageId: "zul",
  }).catch((failure: unknown) => failure);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe("OMITTED_FIELD_ID");
});

it("translated_prompts_keep_the_canonical_field_names", async () => {
  vi.mocked(completeXavaniJson).mockImplementationOnce(
    async (_config, _system, _input, parse) =>
      parse({
        fields: [
          { id: "full_name", label: "Igama eliphelele", prompt: "Ngubani igama lakho eliphelele?" },
          { id: "permission", label: "Imvume", prompt: "Uyavuma yini?" },
          {
            id: "method",
            label: "Indlela yokuxhumana",
            prompt: "Sikuxhumane kanjani?",
            options: ["Email", "Phone"],
            // Untrusted extras the model must never smuggle into the session:
            x: 40,
            y: 700,
            storagePath: "evil/path.pdf",
          },
        ],
      } as never),
  );
  const fields = await extractFormFields(INSPECTED, { languageId: "zul" });
  expect(fields.map((field) => field.id)).toEqual([
    "full_name",
    "permission",
    "method",
  ]);
  expect(fields[0]).toMatchObject({
    label: "Igama eliphelele",
    prompt: "Ngubani igama lakho eliphelele?",
  });
  expect(fields[0]).not.toHaveProperty("x");
  expect(fields[0]).not.toHaveProperty("storagePath");
  expect(fields[2]).toStrictEqual({
    id: "method",
    label: "Indlela yokuxhumana",
    type: "text",
    required: false,
    prompt: "Sikuxhumane kanjani?",
    kind: "choice",
    options: ["Email", "Phone"],
  });
});

it("a_failed_translation_fails_visibly", async () => {
  vi.mocked(completeXavaniJson).mockRejectedValueOnce(
    new Error("XAVANI_UNAVAILABLE"),
  );
  await expect(
    extractFormFields(INSPECTED, { languageId: "zul" }),
  ).rejects.toThrow("FORM_TRANSLATION_FAILED");
});
