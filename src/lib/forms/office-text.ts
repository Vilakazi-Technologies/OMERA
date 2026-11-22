import { FORM_PDF_TEXT_CHAR_BUDGET } from "@/lib/forms/pdf-limits";

function clip(text: string): string {
  return text.replace(/\u0000/g, "").slice(0, FORM_PDF_TEXT_CHAR_BUDGET);
}

/** Readable characters from a file we could not parse as Word. */
export function printableExcerpt(bytes: Uint8Array): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, 8_000));
  const text = Buffer.from(slice).toString("utf8");
  return clip(
    text
      .replace(/[^\p{L}\p{N}\p{P}\p{Z}\n]/gu, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return clip(result.value ?? "");
}

export async function extractDocText(bytes: Uint8Array): Promise<string> {
  const loaded = await import("word-extractor");
  const WordExtractor =
    (loaded as { default?: new () => WordExtractorLike }).default ??
    (loaded as unknown as new () => WordExtractorLike);
  const extractor = new WordExtractor();
  const extracted = await extractor.extract(Buffer.from(bytes));
  const parts = [extracted.getBody?.() ?? "", extracted.getFooters?.() ?? ""];
  return clip(parts.join("\n"));
}

type WordExtractorLike = {
  extract(source: Buffer): Promise<{
    getBody?: () => string;
    getFooters?: () => string;
  }>;
};

export async function readOfficeText(
  kind: "docx" | "doc",
  bytes: Uint8Array,
): Promise<string> {
  try {
    const text = kind === "docx" ? await extractDocxText(bytes) : await extractDocText(bytes);
    if (text.trim()) return text;
  } catch (error) {
    console.error(
      "[forms/office-text]",
      kind,
      error instanceof Error ? error.name : "UnknownError",
    );
  }
  return printableExcerpt(bytes);
}
