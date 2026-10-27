/**
 * Strict form contracts for completed PDF forms (I4).
 *
 * Typed answer values (`string` for text and choices, `boolean` for
 * checkboxes), immutable document metadata, the strict Xavani response
 * schema (exact coverage of the server field ID set), and answer-patch
 * validation against the stored field definition.
 *
 * No PDF coordinates, labels, or prompts from the model are ever trusted
 * as field identity: the canonical `id` set always comes from the C10
 * codec inspection on the server.
 */

export type FormAnswerValue = string | boolean;

export type FormDocumentKind = "acroform" | "flat";

export type FormDocumentStatus = "in_progress" | "review" | "completed";

export type FormDocumentMeta = {
  /** Lowercase hex SHA-256 of the original stored bytes. Immutable. */
  documentSha256: string;
  /** AcroForm fill path vs flat template path. Immutable. */
  documentKind: FormDocumentKind;
  /** Starts at 1, increments on every accepted answer patch. Immutable per write. */
  revision: number;
  status: FormDocumentStatus;
};

export type CanonicalFieldDef = {
  id: string;
  kind: "text" | "checkbox" | "choice" | "signature";
  required: boolean;
  options?: string[];
};

export type TranslatedPrompt = {
  id: string;
  label: string;
  prompt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validate a Xavani JSON response against the exact server field ID set.
 * Rejects duplicate IDs, added IDs, omitted IDs, and invalid options.
 * Returns translated labels/prompts keyed by the canonical IDs — never
 * coordinates, storage paths, or document metadata.
 */
export function parseStrictXavaniFields(
  response: unknown,
  defs: CanonicalFieldDef[],
): TranslatedPrompt[] {
  if (!isRecord(response) || !Array.isArray(response.fields)) {
    throw new Error("INVALID_XAVANI_FIELDS");
  }
  const entries = response.fields as unknown[];
  const seen = new Set<string>();
  const prompts: TranslatedPrompt[] = [];
  const byId = new Map(defs.map((def) => [def.id, def]));

  for (const entry of entries) {
    if (!isRecord(entry)) throw new Error("INVALID_XAVANI_FIELDS");
    const { id, label, prompt, options } = entry;
    if (typeof id !== "string" || !id) throw new Error("INVALID_XAVANI_FIELDS");
    if (typeof label !== "string" || !label.trim()) {
      throw new Error("INVALID_XAVANI_FIELDS");
    }
    if (typeof prompt !== "string" || !prompt.trim()) {
      throw new Error("INVALID_XAVANI_FIELDS");
    }
    if (seen.has(id)) throw new Error("DUPLICATE_FIELD_ID");
    seen.add(id);
    const def = byId.get(id);
    if (!def) throw new Error("ADDED_FIELD_ID");
    if (options !== undefined) {
      if (!Array.isArray(options) || def.kind !== "choice") {
        throw new Error("INVALID_OPTION");
      }
      const allowed = def.options ?? [];
      if (
        options.length !== allowed.length ||
        options.some(
          (option, index) => typeof option !== "string" || option !== allowed[index],
        )
      ) {
        throw new Error("INVALID_OPTION");
      }
    }
    prompts.push({ id, label, prompt });
  }

  for (const def of defs) {
    if (!seen.has(def.id)) throw new Error("OMITTED_FIELD_ID");
  }
  return prompts;
}

/**
 * Validate only the submitted subset of answers: unknown IDs, wrong value
 * types, and invalid choices are rejected, but missing required values
 * are allowed. Incremental saves must accept partial progress; required
 * completeness is enforced at export time by `validateAnswerPatch`.
 */
export function validateSubmittedAnswers(
  defs: CanonicalFieldDef[],
  answers: Record<string, FormAnswerValue>,
): void {
  const byId = new Map(defs.map((def) => [def.id, def]));
  for (const id of Object.keys(answers)) {
    const def = byId.get(id);
    if (!def) throw new Error("UNKNOWN_ANSWER_ID");
    const value = answers[id];
    if (def.kind === "checkbox") {
      if (typeof value !== "boolean") throw new Error("INVALID_ANSWER_TYPE");
      continue;
    }
    if (typeof value !== "string") throw new Error("INVALID_ANSWER_TYPE");
    if (
      def.kind === "choice" &&
      value !== "" &&
      !(def.options ?? []).includes(value)
    ) {
      throw new Error("INVALID_CHOICE");
    }
  }
}

/**
 * Validate an answer patch against the stored field definitions.
 * Unknown IDs, missing required values, wrong value types, and invalid
 * choices are all rejected.
 */
export function validateAnswerPatch(
  defs: CanonicalFieldDef[],
  answers: Record<string, FormAnswerValue>,
): void {
  const byId = new Map(defs.map((def) => [def.id, def]));
  for (const id of Object.keys(answers)) {
    if (!byId.has(id)) throw new Error("UNKNOWN_ANSWER_ID");
  }
  for (const def of defs) {
    const hasOwn = Object.prototype.hasOwnProperty.call(answers, def.id);
    const value = hasOwn ? answers[def.id] : undefined;
    if (def.kind === "checkbox") {
      if (typeof value !== "boolean") {
        if (!hasOwn && !def.required) continue;
        throw new Error(
          hasOwn ? "INVALID_ANSWER_TYPE" : "MISSING_REQUIRED_VALUE",
        );
      }
      if (def.required && value === false) {
        throw new Error("MISSING_REQUIRED_VALUE");
      }
      continue;
    }
    if (value !== undefined && typeof value !== "string") {
      throw new Error("INVALID_ANSWER_TYPE");
    }
    const text = typeof value === "string" ? value : "";
    if (def.required && !text.trim()) {
      throw new Error("MISSING_REQUIRED_VALUE");
    }
    if (
      def.kind === "choice" &&
      text !== "" &&
      !(def.options ?? []).includes(text)
    ) {
      throw new Error("INVALID_CHOICE");
    }
  }
}
