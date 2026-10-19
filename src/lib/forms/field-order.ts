import type { StoredFormField } from "@/lib/db/form-sessions";

/** Required fields first so MVP users reach export-critical questions sooner. */
export function sortFieldsForQuestionFlow(
  fields: StoredFormField[],
): StoredFormField[] {
  return [...fields].sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}
