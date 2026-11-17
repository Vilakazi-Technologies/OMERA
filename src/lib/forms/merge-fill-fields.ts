import type { StoredFormField } from "@/lib/db/form-sessions";
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

/**
 * Union of AcroForm widgets, model rows, and printed blanks / SBD returnables.
 * Keeps the first occurrence's id (AcroForm names must survive for PDF fill).
 */
export function mergeFillFields(
  ...lists: StoredFormField[][]
): StoredFormField[] {
  const merged: StoredFormField[] = [];
  for (const list of lists) {
    for (const field of list) {
      const label = field.label.replace(/\s+/g, " ").trim();
      if (!label) continue;
      if (
        merged.some((row) => labelsCoverSameQuestion(row.label, label))
      ) {
        continue;
      }
      merged.push(field);
      if (merged.length >= FORM_MAX_INFERRED_FIELDS) {
        return sortFieldsForQuestionFlow(merged);
      }
    }
  }
  return sortFieldsForQuestionFlow(merged);
}
