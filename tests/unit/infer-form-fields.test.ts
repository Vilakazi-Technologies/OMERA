import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/chat-runtime", () => ({
  completeConfiguredJson: vi.fn(),
}));
vi.mock("@/lib/forms/pdf-text", () => ({
  extractTextFromPdf: vi.fn(),
}));

import { completeConfiguredJson } from "@/lib/ai/chat-runtime";
import { extractTextFromPdf } from "@/lib/forms/pdf-text";
import { inferFormFieldsFromDocument } from "@/lib/forms/infer-form-fields";

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

beforeEach(() => {
  vi.mocked(extractTextFromPdf).mockReset();
  vi.mocked(completeConfiguredJson).mockReset();
});

it("returns empty when extracted text is too short", async () => {
  vi.mocked(extractTextFromPdf).mockResolvedValueOnce("short");
  const fields = await inferFormFieldsFromDocument(PDF_BYTES, {
    languageId: "eng",
  });
  expect(fields).toEqual([]);
  expect(completeConfiguredJson).not.toHaveBeenCalled();
});

it("maps inferred AI fields to stored session fields", async () => {
  vi.mocked(extractTextFromPdf).mockResolvedValueOnce(
    "Application for leave\nName: ______\nSignature: ______",
  );
  vi.mocked(completeConfiguredJson).mockImplementationOnce(
    async (_system, _input, parse) =>
      parse({
        fields: [
          {
            label: "Full name",
            prompt: "What is your full name?",
            kind: "text",
            required: true,
          },
          {
            label: "Signature",
            prompt: "Type your name to sign",
            kind: "signature",
            required: true,
          },
        ],
      }),
  );
  const fields = await inferFormFieldsFromDocument(PDF_BYTES, {
    languageId: "eng",
  });
  expect(fields).toHaveLength(2);
  expect(fields[0].id).toMatch(/^field_1_/);
  expect(fields[1].kind).toBe("signature");
});
