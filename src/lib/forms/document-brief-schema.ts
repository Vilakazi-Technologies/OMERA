export const DOCUMENT_KIND_VALUES = [
  "tender",
  "rfp",
  "rfq",
  "application",
  "form",
  "other",
] as const;

export type BriefDocumentKind = (typeof DOCUMENT_KIND_VALUES)[number];

export type BriefParty = {
  role: string;
  name: string;
};

export type BriefWhatWasRead = {
  pagesRead: number;
  pageCount: number;
  truncated: boolean;
  note: string;
};

export type FormDocumentBrief = {
  title: string;
  documentKind: BriefDocumentKind;
  summary: string;
  sections: string[];
  keyFacts: string[];
  parties: BriefParty[];
  eligibility: string;
  deadlines: string[];
  requiredAttachments: string[];
  actionsNow: string[];
  implications: string[];
  fillableSections: string[];
  whatWasRead: BriefWhatWasRead;
};

export function defaultWhatWasRead(
  pagesRead = 0,
  pageCount = 0,
  truncated = false,
): BriefWhatWasRead {
  const read = Math.max(0, Math.floor(pagesRead));
  const total = Math.max(read, Math.floor(pageCount));
  const cut = truncated || (total > 0 && read < total);
  const note =
    total === 0
      ? "Omera briefed this file from the extractable text."
      : cut
        ? `Omera read the first ${read} of ${total} pages (extractable text). Later pages were not sent to the briefing.`
        : `Omera read all ${total} page${total === 1 ? "" : "s"} that could be extracted as text.`;
  return {
    pagesRead: read,
    pageCount: total,
    truncated: cut,
    note,
  };
}

export function asStringArray(value: unknown, max = 16, itemMax = 280): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const text = entry.trim();
    if (text) items.push(text.slice(0, itemMax));
    if (items.length >= max) break;
  }
  return items;
}

function asKind(value: unknown): BriefDocumentKind {
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if ((DOCUMENT_KIND_VALUES as readonly string[]).includes(lower)) {
      return lower as BriefDocumentKind;
    }
    if (lower.includes("rfq") || lower.includes("quotation")) return "rfq";
    if (lower.includes("rfp") || lower.includes("proposal")) return "rfp";
    if (lower.includes("tender") || lower.includes("bid")) return "tender";
    if (lower.includes("application")) return "application";
    if (lower.includes("form")) return "form";
  }
  return "other";
}

function asParties(value: unknown): BriefParty[] {
  if (!Array.isArray(value)) return [];
  const parties: BriefParty[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const name = entry.trim().slice(0, 160);
      if (name) parties.push({ role: "Party", name });
    } else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      const name =
        typeof record.name === "string"
          ? record.name.trim().slice(0, 160)
          : typeof record.party === "string"
            ? record.party.trim().slice(0, 160)
            : "";
      const role =
        typeof record.role === "string"
          ? record.role.trim().slice(0, 80)
          : "Party";
      if (name) parties.push({ role: role || "Party", name });
    }
    if (parties.length >= 12) break;
  }
  return parties;
}

function asCoverage(
  value: unknown,
  fallback: BriefWhatWasRead,
): BriefWhatWasRead {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const note =
    typeof record.note === "string" && record.note.trim()
      ? record.note.trim().slice(0, 400)
      : fallback.note;
  return {
    pagesRead: fallback.pagesRead,
    pageCount: fallback.pageCount,
    truncated: fallback.truncated,
    note,
  };
}

export function parseDocumentBrief(
  response: unknown,
  coverage: BriefWhatWasRead = defaultWhatWasRead(),
): FormDocumentBrief {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("INVALID_DOCUMENT_BRIEF");
  }
  const record = response as Record<string, unknown>;
  const title =
    typeof record.title === "string" ? record.title.trim().slice(0, 200) : "";
  const summaryRaw =
    typeof record.summary === "string" ? record.summary.trim() : "";
  const summary = summaryRaw.slice(0, 8000);
  if (!title && !summary) throw new Error("INVALID_DOCUMENT_BRIEF");
  const eligibility =
    typeof record.eligibility === "string"
      ? record.eligibility.trim().slice(0, 800)
      : "";
  const sections = asStringArray(record.sections ?? record.outline, 24, 320);
  const requiredAttachments = asStringArray(
    record.requiredAttachments ?? record.attachments,
    16,
    240,
  );
  return {
    title: title || "Uploaded document",
    documentKind: asKind(record.documentKind ?? record.kind),
    summary: summary || title,
    sections,
    keyFacts: asStringArray(record.keyFacts, 20, 280),
    parties: asParties(record.parties),
    eligibility: eligibility || "Not stated in the pages Omera could read.",
    deadlines: asStringArray(record.deadlines, 16, 240),
    requiredAttachments,
    actionsNow: asStringArray(record.actionsNow, 16, 280),
    implications: asStringArray(record.implications, 16, 280),
    fillableSections: asStringArray(record.fillableSections, 16, 160),
    whatWasRead: asCoverage(record.whatWasRead, coverage),
  };
}

export function tryParseDocumentBrief(
  raw: unknown,
): FormDocumentBrief | null {
  try {
    return parseDocumentBrief(raw);
  } catch {
    return null;
  }
}
