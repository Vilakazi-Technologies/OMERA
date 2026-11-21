import { expect, it, vi } from "vitest";
vi.mock("@/lib/forms/pdfjs-dom", () => ({ ensurePdfJsDom: vi.fn() }));
vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn(async () => ({})),
  extractText: vi.fn(),
}));
import { extractText } from "unpdf";
import { extractPdfDocument } from "@/lib/forms/pdf-text";

const MARKER = "SECRET_MARKER_pdftext_4b8d";

it("pdf_extract_failure_keeps_the_raw_message_out_of_the_log", async () => {
  vi.mocked(extractText).mockRejectedValueOnce(new Error(MARKER));
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await expect(
    extractPdfDocument(Buffer.from("%PDF-1.7")),
  ).rejects.toThrow("MALFORMED_PDF");
  expect(spy.mock.calls.flat().map(String).join(" ")).not.toContain(MARKER);
  spy.mockRestore();
});
