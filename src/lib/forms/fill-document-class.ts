import type { BriefDocumentKind } from "@/lib/forms/document-brief-schema";

/** Pack types we tailor Q&A for. Ordinary AcroForms fall through to "form". */
export const FILL_DOCUMENT_CLASSES = [
  "rfp",
  "rfq",
  "rfb",
  "rfi",
  "eoi",
  "bid",
  "quotation",
  "proposal",
  "application",
  "form",
] as const;

export type FillDocumentClass = (typeof FILL_DOCUMENT_CLASSES)[number];

function normalizeFillText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\br\s*\.\s*f\s*\.\s*p\s*\.\s*o\b/g, "rfpo")
    .replace(/\br\s*\.\s*f\s*\.\s*p\b/g, "rfp")
    .replace(/\br\s*\.\s*f\s*\.\s*q\b/g, "rfq")
    .replace(/\br\s*\.\s*f\s*\.\s*b\b/g, "rfb")
    .replace(/\br\s*\.\s*f\s*\.\s*i\b/g, "rfi")
    .replace(/\be\s*\.\s*o\s*\.\s*i\b/g, "eoi")
    .replace(/\bsbd[\s-]*(\d)/g, "sbd $1")
    .replace(/\bmbd[\s-]*(\d)/g, "mbd $1");
}

/**
 * Classify extractable text so field prompts stay generic across tenders
 * and ordinary forms — not one issuer’s RFP layout.
 */
export function detectFillDocumentClass(text: string): FillDocumentClass {
  const lower = normalizeFillText(text);

  if (
    /\brfpo\b/.test(lower) ||
    /\brfp\b/.test(lower) ||
    /\breq\w{0,5}t\s+for\s+propos/.test(lower) ||
    /\bversoek\s+om\s+voorstel\b/.test(lower)
  ) {
    return "rfp";
  }
  if (
    /\brfq\b/.test(lower) ||
    /\breq\w{0,5}t\s+for\s+q[ou]{1,2}tat/.test(lower) ||
    /\bversoek\s+om\s+kwotasie\b/.test(lower)
  ) {
    return "rfq";
  }
  if (/\brfb\b/.test(lower) || /\breq\w{0,5}t\s+for\s+bid\b/.test(lower)) {
    return "rfb";
  }
  if (
    /\brfi\b/.test(lower) ||
    /\breq\w{0,5}t\s+for\s+information\b/.test(lower)
  ) {
    return "rfi";
  }
  if (
    /\beoi\b/.test(lower) ||
    /\bexpres+ions?\s+of\s+interests?\b/.test(lower)
  ) {
    return "eoi";
  }
  if (/\bquotation\b|\bquote request\b/.test(lower)) return "quotation";
  if (
    /\binvit[a-z]*tion\s+to\s+bid\b/.test(lower) ||
    /\binvitation\s+to\s+tender\b/.test(lower) ||
    /\buitnodiging\s+om\s+te\s+(?:bid|tender|bie)\b/.test(lower) ||
    /\bbid number\b/.test(lower) ||
    /\btender\b/.test(lower) ||
    /\b(?:sbd|mbd)\s*\d/.test(lower)
  ) {
    return "bid";
  }
  if (/\bproposal\b/.test(lower)) return "proposal";
  if (/\bapplication for\b|\bapplication form\b|\bapplication\b/.test(lower)) {
    return "application";
  }
  return "form";
}

export function toBriefDocumentKind(
  fillClass: FillDocumentClass,
): BriefDocumentKind {
  switch (fillClass) {
    case "rfp":
    case "proposal":
      return "rfp";
    case "rfq":
    case "quotation":
      return "rfq";
    case "bid":
    case "rfb":
      return "tender";
    case "application":
      return "application";
    case "rfi":
    case "eoi":
      return "other";
    default:
      return "form";
  }
}

export function fillClassPromptHint(fillClass: FillDocumentClass): string {
  switch (fillClass) {
    case "rfp":
      return "This is a request for proposal (RFP), including RFPO-style packs.";
    case "rfq":
      return "This is a request for quotation (RFQ).";
    case "rfb":
      return "This is a request for bid (RFB).";
    case "rfi":
      return "This is a request for information (RFI).";
    case "eoi":
      return "This is an expression of interest (EOI).";
    case "quotation":
      return "This is a quotation / quote request.";
    case "proposal":
      return "This is a proposal document with fill-in places.";
    case "bid":
      return "This is a bid or tender pack (SBD/MBD returnables).";
    case "application":
      return "This is an application form.";
    default:
      return "This is a generic fill-in form. Ask every widget or labeled blank in sensible order. Do not drop ordinary fields.";
  }
}
