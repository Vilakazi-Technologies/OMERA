import "server-only";
import {
  completeXavaniJson,
  getXavaniConfig,
} from "@/lib/ai/xavani-client";
import {
  parseStrictXavaniFields,
  type CanonicalFieldDef,
} from "@/lib/forms/contracts";
import type { StoredFormField } from "@/lib/db/form-sessions";
import type { PdfFieldInfo } from "@/lib/forms/pdf-fields";

const SYSTEM_PROMPT =
  "You translate PDF form field labels and questions. " +
  "Return JSON only: { \"fields\": [ { \"id\": \"exact-canonical-id\", " +
  "\"label\": \"Translated human label\", \"prompt\": \"Translated question\" } ] }. " +
  "Reuse every canonical id exactly once: never duplicate, add, omit, or rename an id. " +
  "Never invent PDF coordinates, page numbers, storage paths, or document metadata. " +
  "Translate labels and prompts only; field identity always stays canonical.";

const SCHEMA_ERRORS = new Set([
  "INVALID_XAVANI_FIELDS",
  "DUPLICATE_FIELD_ID",
  "ADDED_FIELD_ID",
  "OMITTED_FIELD_ID",
  "INVALID_OPTION",
]);

/**
 * Interpret codec-inspected fields through the Xavani runtime.
 * Labels and translated questions come from the model; field identity,
 * kinds, options, and required flags always come from the C10 inspection.
 * Never returns demo fields. Fails visibly when translation fails.
 */
export async function extractFormFields(
  inspected: PdfFieldInfo[],
  options: { languageId: string },
): Promise<StoredFormField[]> {
  if (!inspected.length) throw new Error("NO_FIELDS_TO_INTERPRET");
  const defs: CanonicalFieldDef[] = inspected.map((field) => ({
    id: field.id,
    kind: field.kind,
    required: field.required,
    options: field.options,
  }));

  let config;
  try {
    config = getXavaniConfig();
  } catch {
    throw new Error("FORM_TRANSLATION_FAILED");
  }

  let prompts;
  try {
    prompts = await completeXavaniJson(
      config,
      SYSTEM_PROMPT,
      JSON.stringify({ languageId: options.languageId, fields: defs }),
      (value) => parseStrictXavaniFields(value, defs),
    );
  } catch (error) {
    if (error instanceof Error && SCHEMA_ERRORS.has(error.message)) throw error;
    throw new Error("FORM_TRANSLATION_FAILED");
  }

  const translated = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  return inspected.map((field) => ({
    id: field.id,
    label: translated.get(field.id)?.label ?? field.id,
    type: "text" as const,
    required: field.required,
    prompt:
      translated.get(field.id)?.prompt ??
      `Please provide a value for ${field.id}.`,
    kind: field.kind,
    ...(field.options ? { options: field.options } : {}),
  }));
}
