import type { StoredFormField } from "@/lib/db/form-sessions";
import { mergeFillFields } from "@/lib/forms/merge-fill-fields";
import {
  canonicalFillLabel,
  declarationQuestionLabel,
  FILL_BLANK_RUN,
  humanQuestionLabel,
  isAnswerOrAttachItem,
} from "@/lib/forms/fill-item-filter";
import { FORM_MAX_INFERRED_FIELDS } from "@/lib/forms/pdf-limits";

const MAX_HEURISTIC_FIELDS = FORM_MAX_INFERRED_FIELDS;
const SCAN_CAP = FORM_MAX_INFERRED_FIELDS + 40;
const SKIP_LINE =
  /^(page\s+\d+\b|[-–—]\s*\d+\s*[-–—]|application(\s+form)?$|application\s+for\b.{0,60}$|form$|instructions?$|please\s+(complete|fill)\b|note:|background$|introduction$|scope of work\b|evaluation criteria\b)/i;
const SKIP_LABEL =
  /^(closing date|closing time|page|rfq no|rfp no|bid no|bid number|tender no|non-?compulsory|briefing session|venue)$/i;
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
  const human = humanQuestionLabel(trimmed);
  if (!human || SKIP_LABEL.test(human)) return;
  if (!force && !isAnswerOrAttachItem(human, sourceLine || trimmed)) return;
  const key = human.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  const index = fields.length + 1;
  fields.push({
    id: slugId(human, index),
    label: human,
    type: "text",
    required:
      kind === "signature" ||
      /name|date|id\b|id number|sbd|mbd|bidder|csd|tax|b-?bb+ee/i.test(human),
    prompt: human,
    kind,
  });
}

/** PDF text often splits leaders into ". . . ." or "_ _ _ _". Collapse those into a blank. */
export function collapseFillLeaders(line: string): string {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/(?:\.\s+){3,}\.?/g, " ______ ")
    .replace(/(?:_\s+){2,}_?/g, " ______ ")
    .replace(/(?:[·•]\s*){4,}/g, " ______ ")
    .replace(/(?:\u2026\s*){2,}/g, " ______ ")
    .replace(/(?:\u22ef\s*){2,}/g, " ______ ")
    .replace(/\.{4,}/g, " ______ ")
    .replace(/_{2,}/g, " ______ ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isLeaderOnly(line: string): boolean {
  const collapsed = collapseFillLeaders(line);
  if (!/_{3,}/.test(collapsed)) return false;
  return collapsed.replace(/_+/g, "").replace(/[\s:.\-–—]+/g, "").length < 3;
}

function rememberLabel(
  found: { label: string; kind: NonNullable<StoredFormField["kind"]> }[],
  label: string,
  kind: NonNullable<StoredFormField["kind"]>,
): void {
  const trimmed = label.replace(/[:.\s]+$/g, "").trim();
  if (!trimmed || /^(code|number|no\.?|item)$/i.test(trimmed)) return;
  if (found.some((row) => row.label.toLowerCase() === trimmed.toLowerCase())) return;
  found.push({ label: trimmed, kind });
}

function labelsFromLine(line: string): {
  label: string;
  kind: NonNullable<StoredFormField["kind"]>;
}[] {
  const found: { label: string; kind: NonNullable<StoredFormField["kind"]> }[] = [];
  const blankTail = String.raw`(?:_{2,}|\.{3,}|\u2026+|\u22ef+|[·.]{5,}|\[[\s_xX.]{0,8}\]|$)`;
  const labeled = new RegExp(
    String.raw`(.{2,80}?)[:?]\s*${blankTail}`,
    "g",
  );
  for (const match of line.matchAll(labeled)) {
    const after = line.slice(match.index! + match[0].length);
    const consumedBlank = FILL_BLANK_RUN.test(match[0]) || /[:?]\s*$/.test(match[0]);
    if (!consumedBlank && after.trim()) continue;
    const label = match[1]?.replace(/[.]+$/, "").trim();
    if (!label) continue;
    rememberLabel(found, label, kindFromLabel(label));
  }
  const leader = /([A-Za-z][^_:?\n]{1,60}?)\s+_{3,}/g;
  for (const match of line.matchAll(leader)) {
    const label = match[1]?.trim();
    if (!label) continue;
    rememberLabel(found, label, kindFromLabel(label));
  }
  const checkbox = /^[\[\(][\sxX]?[\]\)]\s+(.{2,80})$/.exec(line);
  if (checkbox) {
    rememberLabel(found, checkbox[1].replace(/[.]+$/, "").trim(), "checkbox");
  }
  if (/\bsign(ature)?\b|\bsign here\b/i.test(line) && !found.some((row) => row.kind === "signature")) {
    rememberLabel(found, "Signature", "signature");
  }
  return found;
}

function fitFieldBudget(fields: StoredFormField[]): StoredFormField[] {
  if (fields.length <= MAX_HEURISTIC_FIELDS) return fields;
  const returnables: StoredFormField[] = [];
  const rest: StoredFormField[] = [];
  for (const field of fields) {
    if (/\b(sbd|mbd)\b/i.test(field.label)) returnables.push(field);
    else rest.push(field);
  }
  const room = Math.max(0, MAX_HEURISTIC_FIELDS - returnables.length);
  return [...rest.slice(0, room), ...returnables].slice(0, MAX_HEURISTIC_FIELDS);
}

function inferReturnableForms(text: string, fields: StoredFormField[], seen: Set<string>): void {
  for (const match of text.matchAll(/\b(SBD|MBD)\s*(\d+(?:\.\d+)?)\b/gi)) {
    if (fields.length >= SCAN_CAP) break;
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

  for (let index = 0; index < lines.length; index += 1) {
    if (fields.length >= SCAN_CAP) break;
    const raw = lines[index]!.replace(/\u00a0/g, " ").trim();
    if (raw.length < 3) continue;
    const line = collapseFillLeaders(raw);
    if (line.length < 3) continue;
    if (line.length > 400 && !/[:_]/.test(line) && !FILL_BLANK_RUN.test(raw)) continue;
    if (SKIP_LINE.test(line) || SKIP_LINE.test(raw)) continue;
    const words = line.split(/\s+/).filter(Boolean).length;
    if (
      words > 22 &&
      !/[:_]/.test(line) &&
      !FILL_BLANK_RUN.test(line) &&
      !/[\[\(]\s*[\]\)]/.test(line) &&
      !/\b(sbd|mbd)\s*\d/i.test(line) &&
      !/\byes\s*\/\s*no\b/i.test(line)
    ) {
      continue;
    }

    const declared = declarationQuestionLabel(raw) ?? declarationQuestionLabel(line);
    if (declared) {
      pushField(fields, seen, declared, "checkbox", raw);
    }

    const labeled = labelsFromLine(line);
    for (const item of labeled) {
      if (fields.length >= SCAN_CAP) break;
      pushField(fields, seen, item.label, item.kind, line);
    }

    if (!declared && labeled.length === 0) {
      const bare = canonicalFillLabel(line);
      if (bare) {
        pushField(fields, seen, bare, kindFromLabel(bare), line, true);
      }
    }

    const nextRaw = lines[index + 1]?.replace(/\u00a0/g, " ").trim() ?? "";
    if (
      nextRaw &&
      isLeaderOnly(nextRaw) &&
      words <= 8 &&
      !FILL_BLANK_RUN.test(line) &&
      !/_{3,}/.test(line)
    ) {
      pushField(
        fields,
        seen,
        line.replace(/[:.]+$/, "").trim(),
        kindFromLabel(line),
        `${line}\n${collapseFillLeaders(nextRaw)}`,
      );
    }
  }

  inferReturnableForms(text, fields, seen);
  return mergeFillFields(fitFieldBudget(fields));
}
