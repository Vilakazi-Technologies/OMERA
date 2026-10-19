import "server-only";
import { completeConfiguredJson } from "@/lib/ai/chat-runtime";
import {
  parseStrictXavaniFields,
  type CanonicalFieldDef,
  type TranslatedPrompt,
} from "@/lib/forms/contracts";
import type { StoredFormField } from "@/lib/db/form-sessions";
import type { PdfFieldInfo } from "@/lib/forms/pdf-fields";
import { fallbackFormFields } from "@/lib/forms/field-labels";
import { sortFieldsForQuestionFlow } from "@/lib/forms/field-order";

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

const TRANSLATION_CHUNK = 15;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeTranslated(
  inspected: PdfFieldInfo[],
  prompts: TranslatedPrompt[],
): StoredFormField[] {
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

async function translateDefs(
  defs: CanonicalFieldDef[],
  languageId: string,
): Promise<TranslatedPrompt[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await completeConfiguredJson(
        SYSTEM_PROMPT,
        JSON.stringify({ languageId, fields: defs }),
        (value) => parseStrictXavaniFields(value, defs),
      );
    } catch (error) {
      lastError = error;
      if (error instanceof Error && SCHEMA_ERRORS.has(error.message)) throw error;
      if (attempt === 0) await pause(350);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("FORM_TRANSLATION_FAILED");
}

/**
 * Interpret codec-inspected fields through the configured chat runtime.
 * Falls back to humanized labels when AI is unavailable (MVP / rate limits).
 */
export async function extractFormFields(
  inspected: PdfFieldInfo[],
  options: { languageId: string },
): Promise<StoredFormField[]> {
  if (!inspected.length) throw new Error("NO_FIELDS_TO_INTERPRET");

  const merged: StoredFormField[] = [];

  for (let offset = 0; offset < inspected.length; offset += TRANSLATION_CHUNK) {
    const slice = inspected.slice(offset, offset + TRANSLATION_CHUNK);
    const defs: CanonicalFieldDef[] = slice.map((field) => ({
      id: field.id,
      kind: field.kind,
      required: field.required,
      options: field.options,
    }));

    try {
      const prompts = await translateDefs(defs, options.languageId);
      merged.push(...mergeTranslated(slice, prompts));
    } catch (error) {
      if (error instanceof Error && SCHEMA_ERRORS.has(error.message)) throw error;
      merged.push(...fallbackFormFields(slice));
    }
  }

  return sortFieldsForQuestionFlow(merged);
}
