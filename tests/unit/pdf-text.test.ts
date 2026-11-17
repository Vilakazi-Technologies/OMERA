import { PDFDocument, StandardFonts } from "pdf-lib";
import { expect, it } from "vitest";
import { classifyPdfReadError, extractTextFromPdf } from "@/lib/forms/pdf-text";

it("classifies password errors separately from generic parse failures", () => {
  const encrypted = new Error("No password given");
  encrypted.name = "EncryptedPDFError";
  expect(classifyPdfReadError(encrypted)).toBe("ENCRYPTED_PDF");
  expect(classifyPdfReadError(new Error("bad xref"))).toBe("MALFORMED_PDF");
});

it("extracts text through unpdf / pdf.js getTextContent", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("Omera parser fixture", { x: 40, y: 700, size: 12, font });
  const result = await extractTextFromPdf(Buffer.from(await pdf.save()));
  expect(result).toContain("Omera parser fixture");
});

import { PDFParse } from "pdf-parse";
import { vi } from "vitest";

async function textPdf(pages: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = pdf.addPage();
    if (text) page.drawText(text, { x: 40, y: 700, size: 12, font });
  }
  return Buffer.from(await pdf.save());
}

it("returns only the text on a single page without synthetic markers", async () => {
  const result = await extractTextFromPdf(await textPdf(["First page content"]));
  expect(result).toBe("First page content");
});

it("extracts distinct pages in order without synthetic page markers", async () => {
  const result = await extractTextFromPdf(
    await textPdf(["First page alpha", "Second page beta", "Third page gamma"]),
  );
  expect(result).toBe("First page alpha\n\nSecond page beta\n\nThird page gamma");
  expect(result).not.toMatch(/--\s*\d+\s+of\s+\d+\s*--/);
});

it("returns an empty string for a real blank PDF", async () => {
  expect(await extractTextFromPdf(await textPdf([""]))).toBe("");
});

it("preserves every byte of the input Buffer", async () => {
  const input = await textPdf(["Immutable input"]);
  const before = Buffer.from(input);
  expect(await extractTextFromPdf(input)).toBe("Immutable input");
  expect(Buffer.compare(input, before)).toBe(0);
});

it("reads only a Buffer subview and preserves unrelated surrounding bytes", async () => {
  const pdf = await textPdf(["Subview content"]);
  const prefix = Buffer.from("Unrelated prefix, not a PDF\n");
  const suffix = Buffer.from("\nUnrelated suffix, not a PDF");
  const backing = Buffer.concat([prefix, pdf, suffix]);
  const before = Buffer.from(backing);
  const input = backing.subarray(prefix.length, prefix.length + pdf.length);
  expect(input.byteOffset).toBeGreaterThan(backing.byteOffset);
  expect(await extractTextFromPdf(input)).toBe("Subview content");
  expect(Buffer.compare(backing, before)).toBe(0);
  expect(Buffer.compare(input, pdf)).toBe(0);
});

it.each([
  ["invalid", Buffer.from("This is not a PDF")],
  ["empty", Buffer.alloc(0)],
])("rejects %s input rather than fabricating text", async (_label, input) => {
  await expect(extractTextFromPdf(input)).rejects.toThrow();
});

it("keeps extracted text even when document cleanup is unavailable", async () => {
  expect(await extractTextFromPdf(await textPdf(["Parsed before cleanup"]))).toBe(
    "Parsed before cleanup",
  );
});

it("keeps the parse error when the file is not a PDF", async () => {
  await expect(
    extractTextFromPdf(Buffer.from("Invalid PDF before cleanup rejection")),
  ).rejects.toThrow("MALFORMED_PDF");
});

it("destroys the screenshot parser after a render attempt", async () => {
  const { screenshotPdfPages } = await import("@/lib/forms/pdf-text");
  const destroy = vi.spyOn(PDFParse.prototype, "destroy");
  await screenshotPdfPages(new Uint8Array(await textPdf(["Screenshot cleanup"])));
  expect(destroy).toHaveBeenCalled();
});
