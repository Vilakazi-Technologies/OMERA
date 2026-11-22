import type { StoredFormField } from "@/lib/db/form-sessions";
import { buildDocumentBrief } from "@/lib/forms/document-brief";
import {
  defaultWhatWasRead,
  fallbackDocumentBrief,
  thinTextBrief,
  type FormDocumentBrief,
} from "@/lib/forms/document-brief-schema";
import { NO_FILL_IN_PLACES_MESSAGE } from "@/lib/forms/form-errors";
import { inferFieldsFromExtractedText } from "@/lib/forms/infer-from-text";
import { printableExcerpt, readOfficeText } from "@/lib/forms/office-text";
import { FORM_MIN_READABLE_CHARS } from "@/lib/forms/pdf-limits";

const READY_MESSAGE =
  "I've read your document. Confirm to start filling — I will only ask the questions on the form.";

const THIN_MESSAGE =
  "The text is thin. The briefing says what Omera could read. You can continue or replace the file.";

export async function prepareTextForm(input: {
  kind: "pdf" | "docx" | "doc";
  bytes: Uint8Array;
  fileName: string;
  languageId: string;
}): Promise<{
  fields: StoredFormField[];
  brief: FormDocumentBrief;
  message: string;
  thin: boolean;
}> {
  let text = "";
  try {
    text =
      input.kind === "pdf"
        ? printableExcerpt(input.bytes)
        : await readOfficeText(input.kind, input.bytes);
  } catch (error) {
    console.error(
      "[forms/text]",
      error instanceof Error ? error.name : "UnknownError",
    );
    text = "";
  }

  const trimmed = text.replace(/\s+/g, " ").trim();
  const thin = trimmed.length < FORM_MIN_READABLE_CHARS;
  const fields = thin ? [] : inferFieldsFromExtractedText(text);
  const coverage = defaultWhatWasRead(thin ? 0 : 1, 1, false);
  if (thin) {
    return {
      fields,
      brief: thinTextBrief({ fileName: input.fileName, excerpt: trimmed }),
      message: THIN_MESSAGE,
      thin: true,
    };
  }

  const fieldHints = fields.map((field) => ({
    label: field.label,
    kind: field.kind,
  }));
  const brief = await buildDocumentBrief(text, {
    languageId: input.languageId,
    fileName: input.fileName,
    pagesRead: 1,
    pageCount: 1,
    truncated: false,
    fields: fieldHints,
  }).catch(() =>
    fallbackDocumentBrief({
      fileName: input.fileName,
      fieldLabels: fieldHints.map((field) => field.label),
      coverage,
    }),
  );
  return {
    fields,
    brief,
    message: fields.length > 0 ? READY_MESSAGE : NO_FILL_IN_PLACES_MESSAGE,
    thin: false,
  };
}
