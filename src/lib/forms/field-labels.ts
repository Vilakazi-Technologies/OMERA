import type { PdfFieldInfo } from "@/lib/forms/pdf-fields";
import type { StoredFormField } from "@/lib/db/form-sessions";

export function humanizeFieldId(id: string): string {
  const spaced = id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .trim();
  if (!spaced) return id;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function fallbackFormFields(
  inspected: PdfFieldInfo[],
): StoredFormField[] {
  return inspected.map((field) => {
    const label = humanizeFieldId(field.id);
    let prompt = `What is your ${label.toLowerCase()}?`;
    if (field.kind === "checkbox") {
      prompt = `Is this true: ${label}? (yes or no)`;
    } else if (field.kind === "choice" && field.options?.length) {
      prompt = `Choose one for ${label}: ${field.options.join(", ")}`;
    }
    return {
      id: field.id,
      label,
      type: "text" as const,
      required: field.required,
      prompt,
      kind: field.kind,
      ...(field.options ? { options: field.options } : {}),
    };
  });
}
