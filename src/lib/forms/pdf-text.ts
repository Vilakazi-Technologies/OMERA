import { PDFParse } from "pdf-parse";
import { FORM_PDF_READ_PAGE_LIMIT, FORM_VISION_MAX_PAGES } from "@/lib/forms/pdf-limits";

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

export async function extractPdfDocument(
  buffer: Buffer,
  maxPages = FORM_PDF_READ_PAGE_LIMIT,
): Promise<PdfTextDocument> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({
      pageJoiner: "",
      first: maxPages,
    });
    const pages: PdfPageText[] = result.pages.map((page) => ({
      pageNumber: page.num,
      text: page.text.trim(),
    }));
    const text = result.text.trim();
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
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  return (await extractPdfDocument(buffer)).text;
}

/** Rasterize selected pages so vision can read labels on scans. */
export async function screenshotPdfPages(
  bytes: Uint8Array,
  maxPages = 3,
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
      desiredWidth: 768,
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
    await parser.destroy();
  }
}
