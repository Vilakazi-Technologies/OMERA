import { ensurePdfJsDom } from "@/lib/forms/pdfjs-dom";
import { FORM_PDF_READ_PAGE_LIMIT, FORM_VISION_MAX_PAGES } from "@/lib/forms/pdf-limits";
import { extractText, getDocumentProxy } from "unpdf";

ensurePdfJsDom();

export function classifyPdfReadError(error: unknown): "ENCRYPTED_PDF" | "MALFORMED_PDF" {
  if (!(error instanceof Error)) return "MALFORMED_PDF";
  if (
    error.message === "ENCRYPTED_PDF" ||
    error.name === "EncryptedPDFError" ||
    /encrypt|password/i.test(error.message)
  ) {
    return "ENCRYPTED_PDF";
  }
  return "MALFORMED_PDF";
}

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

export type PdfTextDocument = {
  pages: PdfPageText[];
  text: string;
  totalPages: number;
  truncated: boolean;
};

export function joinPdfPageText(pages: PdfPageText[]): string {
  return pages
    .map((page) => page.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function destroyQuietly(target: unknown): Promise<void> {
  try {
    if (!target || typeof target !== "object" || !("destroy" in target)) return;
    const destroy = (target as { destroy?: unknown }).destroy;
    if (typeof destroy === "function") await (destroy as () => unknown).call(target);
  } catch {
    // pdf.js destroy can reject (or be missing) on serverless after a
    // successful parse. Never let cleanup replace extracted text.
  }
}

/**
 * Text extraction for Node 24 / Vercel. pdf-parse's pdf.js 5 worker +
 * DOMMatrix viewport path throws MALFORMED_PDF there even when the file
 * is a readable RFP. unpdf inlines the worker and uses getTextContent.
 */
export async function extractPdfDocument(
  buffer: Buffer,
  maxPages = FORM_PDF_READ_PAGE_LIMIT,
): Promise<PdfTextDocument> {
  ensurePdfJsDom();
  const data = Uint8Array.from(buffer);
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    pdf = await getDocumentProxy(data);
    const extracted = await extractText(pdf, { mergePages: false });
    const pageTexts = Array.isArray(extracted.text)
      ? extracted.text
      : [extracted.text];
    const totalPages =
      extracted.totalPages > 0 ? extracted.totalPages : pageTexts.length;
    const limit = Math.min(totalPages, maxPages, pageTexts.length);
    const pages: PdfPageText[] = pageTexts.slice(0, limit).map((text, index) => ({
      pageNumber: index + 1,
      text: (text ?? "").replace(/\n?--\s*\d+\s+of\s+\d+\s*--\n?/g, "\n").trim(),
    }));
    return {
      pages,
      text: joinPdfPageText(pages),
      totalPages,
      truncated: totalPages > pages.length,
    };
  } catch (error) {
    console.error(
      "[pdf-text] extract failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    throw new Error(classifyPdfReadError(error), { cause: error });
  } finally {
    await destroyQuietly(pdf);
  }
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  return (await extractPdfDocument(buffer)).text;
}

async function screenshotOnce(
  bytes: Uint8Array,
  maxPages: number,
  pageNumbers?: number[],
): Promise<string[]> {
  ensurePdfJsDom();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const partial =
      pageNumbers
        ?.filter((n) => Number.isInteger(n) && n >= 1)
        .slice(0, FORM_VISION_MAX_PAGES) ?? [];
    const result = await parser.getScreenshot({
      ...(partial.length ? { partial } : { first: maxPages }),
      desiredWidth: 1024,
      imageDataUrl: true,
      imageBuffer: false,
    });
    return result.pages
      .map((page) => page.dataUrl)
      .filter(
        (url): url is string =>
          typeof url === "string" && url.startsWith("data:image/"),
      );
  } finally {
    await destroyQuietly(parser);
  }
}

/** Rasterize selected pages so vision can read labels on scans. */
export async function screenshotPdfPages(
  bytes: Uint8Array,
  maxPages = FORM_VISION_MAX_PAGES,
  pageNumbers?: number[],
): Promise<string[]> {
  try {
    const first = await screenshotOnce(bytes, maxPages, pageNumbers);
    if (first.length) return first;
  } catch {
    // Retry with the first N pages when targeted pages fail (odd page trees).
  }
  try {
    return await screenshotOnce(bytes, maxPages, undefined);
  } catch {
    return [];
  }
}
