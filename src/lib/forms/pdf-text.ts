import { ensurePdfJsDom } from "@/lib/forms/pdfjs-dom";
import { PDFParse } from "pdf-parse";
import { FORM_PDF_READ_PAGE_LIMIT, FORM_VISION_MAX_PAGES } from "@/lib/forms/pdf-limits";

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

async function destroyParser(parser: PDFParse): Promise<void> {
  try {
    await parser.destroy();
  } catch {
    // pdf.js destroy can reject on serverless after a successful parse.
    // Never let cleanup replace extracted text with an empty briefing.
  }
}

export async function extractPdfDocument(
  buffer: Buffer,
  maxPages = FORM_PDF_READ_PAGE_LIMIT,
): Promise<PdfTextDocument> {
  ensurePdfJsDom();
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({ first: maxPages });
    const pages: PdfPageText[] = result.pages.map((page) => ({
      pageNumber: page.num,
      text: page.text.trim(),
    }));
    const fromPages = joinPdfPageText(pages);
    const fromJoined = result.text
      .replace(/\n?--\s*\d+\s+of\s+\d+\s*--\n?/g, "\n")
      .trim();
    const text = fromPages || fromJoined;
    const totalPages =
      typeof result.total === "number" && result.total > 0
        ? result.total
        : pages.length;
    return {
      pages,
      text,
      totalPages,
      truncated: totalPages > pages.length,
    };
  } catch (error) {
    throw new Error(classifyPdfReadError(error));
  } finally {
    await destroyParser(parser);
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
    await destroyParser(parser);
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
