import { PDFParse } from "pdf-parse";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({ pageJoiner: "" });
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

/** Rasterize the first pages so vision can read labels on scans. */
export async function screenshotPdfPages(
  bytes: Uint8Array,
  maxPages = 3,
): Promise<string[]> {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getScreenshot({
      first: maxPages,
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
