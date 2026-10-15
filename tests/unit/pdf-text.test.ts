import { PDFDocument, StandardFonts } from "pdf-lib";
import { expect, it } from "vitest";
import { extractTextFromPdf } from "@/lib/forms/pdf-text";

it("extracts text through pdf-parse version 2", async () => {
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

it("destroys the real parser after successful extraction", async () => {
  const destroy = vi.spyOn(PDFParse.prototype, "destroy");
  expect(await extractTextFromPdf(await textPdf(["Real cleanup success"]))).toBe(
    "Real cleanup success",
  );
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(destroy.mock.results[0].type).toBe("return");
  await expect(destroy.mock.results[0].value).resolves.toBeUndefined();
});

it("destroys the real parser after parsing fails", async () => {
  const destroy = vi.spyOn(PDFParse.prototype, "destroy");
  await expect(extractTextFromPdf(Buffer.from("Invalid PDF for cleanup"))).rejects.toThrow();
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(destroy.mock.results[0].type).toBe("return");
  await expect(destroy.mock.results[0].value).resolves.toBeUndefined();
});

it("characterizes finally: a cleanup rejection replaces successful extraction", async () => {
  const cleanupError = new Error("Cleanup rejected after success");
  const realDestroy = PDFParse.prototype.destroy;
  const destroy = vi.spyOn(PDFParse.prototype, "destroy").mockImplementationOnce(
    async function (this: PDFParse) {
      await realDestroy.call(this);
      throw cleanupError;
    },
  );
  await expect(extractTextFromPdf(await textPdf(["Parsed before cleanup rejection"])))
    .rejects.toBe(cleanupError);
  expect(destroy).toHaveBeenCalledTimes(1);
});

it("characterizes finally: a cleanup rejection replaces the parsing failure", async () => {
  const cleanupError = new Error("Cleanup rejected after parsing failure");
  const realDestroy = PDFParse.prototype.destroy;
  const destroy = vi.spyOn(PDFParse.prototype, "destroy").mockImplementationOnce(
    async function (this: PDFParse) {
      await realDestroy.call(this);
      throw cleanupError;
    },
  );
  await expect(extractTextFromPdf(Buffer.from("Invalid PDF before cleanup rejection")))
    .rejects.toBe(cleanupError);
  expect(destroy).toHaveBeenCalledTimes(1);
});
