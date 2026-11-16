import type { StoredFormField } from "@/lib/db/form-sessions";
import { sortFieldsForQuestionFlow } from "@/lib/forms/field-order";

const MAX_HEURISTIC_FIELDS = 50;
const SKIP_LINE =
  /^(page\s+\d+|application|form|instructions?|please\s+(complete|fill)|note:)/i;

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
): StoredFormField["kind"] {
  if (/\bsign(ature|ed|here)?\b|\bsign\s+here\b/i.test(label)) return "signature";
  if (/\b(yes\/no|true\/false|tick|check\s*box)\b/i.test(label)) return "checkbox";
  return "text";
}

function promptFor(label: string, kind: StoredFormField["kind"]): string {
  if (kind === "signature") {
    return `Type your full name to sign "${label}" (printed signature — not a digital certificate).`;
  }
  if (kind === "checkbox") {
    return `Is this true: ${label}? (yes or no)`;
  }
  return `What is your ${label.toLowerCase()}?`;
}

/**
 * Last-resort questions from readable PDF text when AI inference is down.
 * Looks for labeled blanks ("Name: ______") rather than inventing a template.
 */
export function inferFieldsFromExtractedText(text: string): StoredFormField[] {
  const seen = new Set<string>();
  const fields: StoredFormField[] = [];
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    if (fields.length >= MAX_HEURISTIC_FIELDS) break;
    const line = raw.replace(/\u00a0/g, " ").trim();
    if (line.length < 3 || line.length > 160) continue;
    if (SKIP_LINE.test(line)) continue;

    const labeled = /^(.{2,80}?)[:?]\s*(_{2,}|\[?\s*\]|\.+$|$)/.exec(line);
    const underlined = /^(.{2,80}?)\s+_{3,}/.exec(line);
    const checkbox = /^[\[\(][\sxX]?[\]\)]\s+(.{2,80})$/.exec(line);
    const signHere = /\bsign(ature)?\b|\bsign here\b/i.test(line);

    let label: string | null = null;
    let kind: StoredFormField["kind"] = "text";

    if (checkbox) {
      label = checkbox[1].replace(/[.]+$/, "").trim();
      kind = "checkbox";
    } else if (labeled) {
      label = labeled[1].replace(/[.]+$/, "").trim();
      kind = kindFromLabel(label);
    } else if (underlined) {
      label = underlined[1].replace(/[.]+$/, "").trim();
      kind = kindFromLabel(label);
    } else if (signHere) {
      label = "Signature";
      kind = "signature";
    }

    if (!label || label.length < 2) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const index = fields.length + 1;
    fields.push({
      id: slugId(label, index),
      label,
      type: "text",
      required: kind === "signature" || /name|date|id\b|id number/i.test(label),
      prompt: promptFor(label, kind),
      kind,
    });
  }

  return sortFieldsForQuestionFlow(fields);
}
