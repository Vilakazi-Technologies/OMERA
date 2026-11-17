import type { StoredFormField } from "@/lib/db/form-sessions";
import { sortFieldsForQuestionFlow } from "@/lib/forms/field-order";
import {
  FILL_BLANK_RUN,
  isAnswerOrAttachItem,
  promptForFillItem,
} from "@/lib/forms/fill-item-filter";
import { FORM_MAX_INFERRED_FIELDS } from "@/lib/forms/pdf-limits";

const MAX_HEURISTIC_FIELDS = FORM_MAX_INFERRED_FIELDS;
const SKIP_LINE =
  /^(page\s+\d+|application|form|instructions?|please\s+(complete|fill)|note:|background|introduction|scope of work|evaluation criteria)/i;
const SKIP_LABEL =
  /^(closing date|closing time|page|rfq no|rfp no|bid number|non-?compulsory|briefing session|venue)$/i;
const FORM_TITLES: Record<string, string> = {
  "1": "SBD 1 invitation to bid",
  "3": "SBD 3 pricing schedule",
  "3.1": "SBD 3.1 pricing schedule",
  "3.2": "SBD 3.2 pricing schedule",
  "3.3": "SBD 3.3 pricing schedule",
  "4": "SBD 4 bidders disclosure",
  "6.1": "SBD 6.1 preference points",
  "8": "SBD 8 declaration",
  "9": "SBD 9 independent bid determination",
};

function slugId(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `field_${index}_${base || "item"}`;
}

function kindFromLabel(
  label: string,
): NonNullable<StoredFormField["kind"]> {
  if (/\bsign(ature|ed|here)?\b|\bsign\s+here\b/i.test(label)) return "signature";
  if (/\b(yes\/no|true\/false|tick|check\s*box)\b/i.test(label)) return "checkbox";
  return "text";
}

function pushField(
  fields: StoredFormField[],
  seen: Set<string>,
  label: string,
  kind: NonNullable<StoredFormField["kind"]>,
  sourceLine = "",
  force = false,
): void {
  const trimmed = label.replace(/[:.]+$/, "").replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length < 2 || SKIP_LABEL.test(trimmed)) return;
  if (!force && !isAnswerOrAttachItem(trimmed, sourceLine || trimmed)) return;
  const key = trimmed.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  const index = fields.length + 1;
  fields.push({
    id: slugId(trimmed, index),
    label: trimmed,
    type: "text",
    required:
      kind === "signature" ||
      /name|date|id\b|id number|sbd|mbd|bidder|csd|tax|b-?bb+ee/i.test(trimmed),
    prompt: promptForFillItem(trimmed, kind),
    kind,
  });
}

function labelsFromLine(line: string): {
  label: string;
  kind: NonNullable<StoredFormField["kind"]>;
}[] {
  const found: { label: string; kind: NonNullable<StoredFormField["kind"]> }[] = [];
  const labeled = new RegExp(
    String.raw`(.{2,80}?)[:?]\s*(?:_{2,}|\.{3,}|\u2026+|\u22ef+|[·.]{5,}|\[\s*\]|$)`,
    "g",
  );
  for (const match of line.matchAll(labeled)) {
    const label = match[1]?.replace(/[.]+$/, "").trim();
    if (!label) continue;
    found.push({ label, kind: kindFromLabel(label) });
  }
  if (!found.length) {
    const underlined = /^(.{2,80}?)\s+_{3,}/.exec(line);
    if (underlined) {
      found.push({
        label: underlined[1].replace(/[:.]+$/, "").trim(),
        kind: kindFromLabel(underlined[1]),
      });
    }
  }
  const checkbox = /^[\[\(][\sxX]?[\]\)]\s+(.{2,80})$/.exec(line);
  if (checkbox) {
    found.push({
      label: checkbox[1].replace(/[.]+$/, "").trim(),
      kind: "checkbox",
    });
  }
  if (/\bsign(ature)?\b|\bsign here\b/i.test(line) && !found.some((row) => row.kind === "signature")) {
    found.push({ label: "Signature", kind: "signature" });
  }
  return found;
}

function inferReturnableForms(text: string, fields: StoredFormField[], seen: Set<string>): void {
  for (const match of text.matchAll(/\b(SBD|MBD)\s*(\d+(?:\.\d+)?)\b/gi)) {
    if (fields.length >= MAX_HEURISTIC_FIELDS) break;
    const series = match[1].toUpperCase();
    const num = match[2];
    const sbdLabel = FORM_TITLES[num];
    const label =
      series === "MBD"
        ? `MBD ${num}`
        : (sbdLabel ?? `SBD ${num}`);
    pushField(fields, seen, label, "text", label, true);
  }
}

/**
 * Last-resort questions from readable PDF text when AI inference is down.
 * Looks for labeled blanks ("Name: ______") and SBD/MBD returnables even without AcroForm.
 */
export function inferFieldsFromExtractedText(text: string): StoredFormField[] {
  const seen = new Set<string>();
  const fields: StoredFormField[] = [];
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    if (fields.length >= MAX_HEURISTIC_FIELDS) break;
    const line = raw.replace(/\u00a0/g, " ").trim();
    if (line.length < 3 || line.length > 220) continue;
    if (SKIP_LINE.test(line)) continue;
    const words = line.split(/\s+/).length;
    if (
      words > 18 &&
      !/[:_]/.test(line) &&
      !FILL_BLANK_RUN.test(line) &&
      !/[\[\(]\s*[\]\)]/.test(line) &&
      !/\b(sbd|mbd)\s*\d/i.test(line)
    ) {
      continue;
    }

    for (const item of labelsFromLine(line)) {
      if (fields.length >= MAX_HEURISTIC_FIELDS) break;
      pushField(fields, seen, item.label, item.kind, line);
    }
  }

  inferReturnableForms(text, fields, seen);
  return sortFieldsForQuestionFlow(fields);
}
