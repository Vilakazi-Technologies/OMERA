import type { StoredFormField } from "@/lib/db/form-sessions";
import {
  askForFillItem,
  humanQuestionLabel,
  isModelFillItem,
} from "@/lib/forms/fill-item-filter";
import { sortFieldsForQuestionFlow } from "@/lib/forms/field-order";
import { FORM_MAX_INFERRED_FIELDS } from "@/lib/forms/pdf-limits";

const STOP = new Set([
  "a",
  "an",
  "the",
  "your",
  "full",
  "please",
  "provide",
  "completed",
  "original",
  "signed",
]);

/** Stable compare key so "Full name" and "Name" collapse, but CSD stays distinct. */
export function fieldLabelKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[:.?]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !STOP.has(word))
    .join(" ");
}

function tokens(label: string): string[] {
  const key = fieldLabelKey(label);
  return key ? key.split(" ") : [];
}

export function labelsCoverSameQuestion(existing: string, candidate: string): boolean {
  const a = tokens(existing);
  const b = tokens(candidate);
  if (!a.length || !b.length) return false;
  if (a.join(" ") === b.join(" ")) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length === 1 && shorter[0]!.length < 4) {
    return false;
  }
  return shorter.every((word) => longer.includes(word));
}

const WARNING_IN_PROMPT =
  /\b(disqualif|what is your paid|non-?compulsory briefing)\b/i;

function presentField(field: StoredFormField): StoredFormField | null {
  const label = humanQuestionLabel(field.label);
  if (!label) return null;
  const kind = field.kind ?? "text";
  const incoming = field.prompt?.trim() ?? "";
  const prompt =
    incoming &&
    incoming !== field.label &&
    incoming !== label &&
    !WARNING_IN_PROMPT.test(incoming) &&
    isModelFillItem(label, incoming)
      ? incoming
      : askForFillItem(label, kind);
  return {
    ...field,
    label,
    prompt,
    kind,
  };
}

/**
 * Union of AcroForm widgets, model rows, and printed blanks / SBD returnables.
 * Drops warning scraps and page markers, rewrites labels into bidder language,
 * and keeps the first occurrence's id (AcroForm names must survive for PDF fill).
 */
export function mergeFillFields(
  ...lists: StoredFormField[][]
): StoredFormField[] {
  const merged: StoredFormField[] = [];
  for (const list of lists) {
    for (const field of list) {
      const next = presentField(field);
      if (!next) continue;
      if (merged.some((row) => labelsCoverSameQuestion(row.label, next.label))) {
        continue;
      }
      merged.push(next);
      if (merged.length >= FORM_MAX_INFERRED_FIELDS) {
        return sortFieldsForQuestionFlow(merged);
      }
    }
  }
  return sortFieldsForQuestionFlow(merged);
}
