import type { BriefDocumentKind } from "@/lib/forms/document-brief-schema";

/** Pack types we tailor Q&A for. RFPO is treated as an RFP. */
export const FILL_DOCUMENT_CLASSES = [
  "rfp",
  "rfq",
  "bid",
  "quotation",
  "application",
  "form",
] as const;

export type FillDocumentClass = (typeof FILL_DOCUMENT_CLASSES)[number];

/**
 * Classify extractable text so field prompts stay generic across tenders
 * and ordinary forms — not one issuer’s RFP layout.
 */
export function detectFillDocumentClass(text: string): FillDocumentClass {
  const lower = text.replace(/\s+/g, " ").toLowerCase();
  if (/\brfpo\b|\brfp\b|request for proposal/.test(lower)) return "rfp";
  if (/\brfq\b|request for quotation/.test(lower)) return "rfq";
  if (/\bquotation\b/.test(lower)) return "quotation";
  if (
    /\binvitation to bid\b|\bbid number\b|\btender\b|\bmbd\s*\d/.test(lower)
  ) {
    return "bid";
  }
  if (/\bapplication for\b|\bapplication form\b|\bapplication\b/.test(lower)) {
    return "application";
  }
  return "form";
}

export function toBriefDocumentKind(
  fillClass: FillDocumentClass,
): BriefDocumentKind {
  if (fillClass === "bid") return "tender";
  if (fillClass === "quotation") return "rfq";
  if (fillClass === "rfp" || fillClass === "rfq") return fillClass;
  if (fillClass === "application") return "application";
  return "form";
}

export function fillClassPromptHint(fillClass: FillDocumentClass): string {
  switch (fillClass) {
    case "rfp":
      return "This is a request for proposal (RFP), including RFPO-style packs.";
    case "rfq":
      return "This is a request for quotation (RFQ).";
    case "quotation":
      return "This is a quotation / quote request.";
    case "bid":
      return "This is a bid or tender pack (SBD/MBD returnables).";
    case "application":
      return "This is an application form.";
    default:
      return "This is a generic fill-in form.";
  }
}
