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
    if (lower.includes("rfpo") || lower.includes("rfp") || lower.includes("proposal")) {
      return "rfp";
    }
    if (
      lower.includes("tender") ||
      lower.includes("bid") ||
      lower.includes("rfb") ||
      /\b(sbd|mbd)\b/.test(lower)
    ) {
      return "tender";
    }
    if (lower.includes("rfi") || lower.includes("eoi")) return "other";
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

/**
 * The file opened, but the extractable text is short.
 * Say what was readable and leave the person free to continue.
 */
export function thinTextBrief(input: {
  fileName: string;
  excerpt?: string;
}): FormDocumentBrief {
  const title =
    input.fileName.replace(/\.(pdf|docx?)$/i, "").trim() || "Uploaded document";
  const excerpt = (input.excerpt ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
  const summary = excerpt
    ? `Omera read this much: “${excerpt}”. The rest of the text is thin. Continue, or replace the file with a clearer copy.`
    : "The text in this file is thin. Continue with what you know, or replace the file with a clearer copy.";
  return {
    title,
    documentKind: "form",
    summary,
    sections: [],
    keyFacts: excerpt ? [excerpt] : [],
    parties: [],
    eligibility: "Not stated in the text Omera could use.",
    deadlines: [],
    requiredAttachments: [],
    actionsNow: ["Continue, or replace the file if you have a clearer copy."],
    implications: [],
    fillableSections: [],
    whatWasRead: {
      pagesRead: excerpt ? 1 : 0,
      pageCount: 1,
      truncated: false,
      note: excerpt
        ? "Omera used the short extract above. You can still continue."
        : "The extractable text was thin. You can still continue.",
    },
  };
}

/** Client-safe brief when analyze omits one — never leave the briefing screen empty. */
export function fallbackDocumentBrief(input: {
  fileName: string;
  fieldLabels?: string[];
  coverage?: BriefWhatWasRead;
}): FormDocumentBrief {
  const labels = (input.fieldLabels ?? [])
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 16);
  const title =
    input.fileName.replace(/\.(pdf|docx?)$/i, "").trim() || "Uploaded document";
  const coverage = input.coverage ?? defaultWhatWasRead();
  return {
    title,
    documentKind: labels.length ? "form" : "other",
    summary: labels.length
      ? `Omera found ${labels.length} fill-in question${labels.length === 1 ? "" : "s"} on this PDF.\n\nYou will be asked about: ${labels.slice(0, 8).join("; ")}.`
      : "Omera has this file ready. Scroll this briefing, then upload a form with questions if none were found.",
    sections: [],
    keyFacts: [],
    parties: [],
    eligibility: "Not stated in the pages Omera could read.",
    deadlines: [],
    requiredAttachments: [],
    actionsNow: labels.length
      ? ["Read this briefing, then start filling the questions on the form."]
      : ["If this is the wrong file, upload a form with questions or blanks."],
    implications: [
      "Skipping the briefing can hide closing dates, returnables, and who issued the pack.",
    ],
    fillableSections: labels.slice(0, 12),
    whatWasRead: coverage,
  };
}
