import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/chat-runtime", () => ({
  completeConfiguredJson: vi.fn(),
}));
vi.mock("@/lib/ai/openrouter-client", () => ({
  completeOpenRouterVisionJson: vi.fn(),
  getOpenRouterVisionConfig: vi.fn(() => ({ apiKey: "k", model: "vision" })),
  isOpenRouterConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/forms/pdf-text", () => ({
  extractTextFromPdf: vi.fn(),
  screenshotPdfPages: vi.fn(),
}));

import { completeConfiguredJson } from "@/lib/ai/chat-runtime";
import { completeOpenRouterVisionJson } from "@/lib/ai/openrouter-client";
import { extractTextFromPdf, screenshotPdfPages } from "@/lib/forms/pdf-text";
import { inferFormFieldsFromDocument } from "@/lib/forms/infer-form-fields";

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

const NAME_FIELD = {
  fields: [
    {
      label: "Full name",
      prompt: "What is your full name?",
      kind: "text",
      required: true,
    },
  ],
};

beforeEach(() => {
  vi.mocked(extractTextFromPdf).mockReset();
  vi.mocked(screenshotPdfPages).mockReset();
  vi.mocked(completeConfiguredJson).mockReset();
  vi.mocked(completeOpenRouterVisionJson).mockReset();
  vi.mocked(screenshotPdfPages).mockResolvedValue([]);
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
  expect(completeOpenRouterVisionJson).not.toHaveBeenCalled();
});

it("uses vision when extracted text is too short", async () => {
  vi.mocked(extractTextFromPdf).mockResolvedValueOnce("short");
  vi.mocked(screenshotPdfPages).mockResolvedValueOnce([
    "data:image/png;base64,aaa",
  ]);
  vi.mocked(completeOpenRouterVisionJson).mockImplementationOnce(
    async (_config, _system, _input, images, parse) => {
      expect(images).toEqual(["data:image/png;base64,aaa"]);
      return parse(NAME_FIELD);
    },
  );
  const fields = await inferFormFieldsFromDocument(PDF_BYTES, {
    languageId: "eng",
  });
  expect(fields).toHaveLength(1);
  expect(fields[0].label).toBe("Full name");
  expect(completeConfiguredJson).not.toHaveBeenCalled();
});

it("uses vision when the text model fails on a text PDF", async () => {
  vi.mocked(extractTextFromPdf).mockResolvedValueOnce(
    "Application for leave\nName: ______\nDate: ______",
  );
  vi.mocked(completeConfiguredJson).mockRejectedValueOnce(
    new Error("INVALID_INFERRED_FIELDS"),
  );
  vi.mocked(screenshotPdfPages).mockResolvedValueOnce([
    "data:image/png;base64,bbb",
  ]);
  vi.mocked(completeOpenRouterVisionJson).mockImplementationOnce(
    async (_config, _system, _input, _images, parse) => parse(NAME_FIELD),
  );
  const fields = await inferFormFieldsFromDocument(PDF_BYTES, {
    languageId: "eng",
  });
  expect(fields[0].label).toBe("Full name");
});

it("rejects blank scans when vision also finds nothing", async () => {
  vi.mocked(extractTextFromPdf).mockResolvedValueOnce("");
  vi.mocked(screenshotPdfPages).mockResolvedValueOnce([]);
  await expect(
    inferFormFieldsFromDocument(PDF_BYTES, { languageId: "eng" }),
  ).rejects.toThrow("UNREADABLE_DOCUMENT");
});
