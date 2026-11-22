import { FORM_PDF_FILE_LIMIT_MB } from "@/lib/forms/pdf-limits";

/** Shown on the briefing when a readable PDF has no questions to complete. */
export const NO_FILL_IN_PLACES_MESSAGE =
  "Omera read this document and briefed it below. It has no fill-in blanks, so there is nothing to complete in place — the briefing explains what the document is about and what it asks.";

/** User-facing copy for form API error codes. */
export function formErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "UNREADABLE_DOCUMENT":
    case "MALFORMED_PDF":
    case "INVALID_PDF":
      return "The text in this file is thin. You can continue, or replace it with a clearer copy.";
    case "NO_FILLABLE_FIELDS":
      return NO_FILL_IN_PLACES_MESSAGE;
    case "PDF_PAGE_LIMIT":
      return "This PDF is longer than Omera can fill in place (40 pages). Upload the returnable forms section, or a pack of at most 80 pages so Omera can still brief you and add an answers page.";
    case "INVALID_PDF_SIZE":
    case "FILE_TOO_LARGE":
    case "REQUEST_TOO_LARGE":
      return `This file is larger than the ${FORM_PDF_FILE_LIMIT_MB} MB upload limit (the host may still block files above about 4.5 MB). Compress it or split the pack, then try again.`;
    case "ENCRYPTED_PDF":
      return "This PDF is password-protected. Remove the password in your PDF app (unlock it), then upload the unlocked copy.";
    case "UNSUPPORTED_XFA":
      return "This PDF uses a special form format we cannot complete yet. Export it as a regular PDF from Adobe or your browser, then upload that file.";
    case "FORM_INFERENCE_FAILED":
    case "CHAT_UNAVAILABLE":
      return "Omera is busy right now. Wait a moment and try again.";
    case "FORM_TRANSLATION_FAILED":
      return "The field labels are not ready yet. Wait a moment and try again.";
    case "FORMS_STORAGE_UNAVAILABLE":
    case "STORAGE_UPLOAD_FAILED":
    case "SESSION_CREATE_FAILED":
      return "That did not finish. Wait a moment and try again.";
    case "INCOMPLETE_FORM":
    case "MISSING_REQUIRED_VALUE":
    case "REQUIRED_FIELD":
      return "Some required fields are still empty. Complete every required answer, then download again.";
    case "UNSUPPORTED_CHARACTER":
      return "An answer uses characters this PDF font cannot display. Try simpler spelling or English for that field.";
    case "UNAUTHORIZED":
      return "Sign in to Omera, then upload your form again.";
    case "ORIGIN_FORBIDDEN":
      return "This session could not be verified. Refresh the page, sign in, and try again.";
    case "QUOTA_EXCEEDED":
    case "RATE_LIMITED":
      return "Too many requests right now. Wait a minute and try again.";
    case "SERVICE_UNAVAILABLE":
      return "Omera is temporarily unavailable. Check AI keys on Vercel and try again.";
    case "ANALYZE_TIMEOUT":
      return "Reading this PDF took too long. Upload a smaller file or the returnable forms section only, then try again.";
    case "ANALYZE_FAILED":
      return "Omera hit a server error while reading this PDF. Try again in a minute. This is not a password or file-size problem.";
    case "PDF_FIELD_LIMIT":
      return "This form has more questions than Omera can take in one pass. Upload the returnable section only, then try again.";
    case "UNSUPPORTED_FORMAT":
      return "Choose a PDF or Word document (.pdf, .doc, or .docx).";
    case "INVALID_MULTIPART":
    case "NO_FILE":
    case "EMPTY_FILE":
      return "Choose the file again and retry.";
    case "NETWORK_ERROR":
      return "The upload did not reach Omera. Check your connection and try again.";
    case "UPLOAD_FAILED":
      return "That did not finish. Wait a moment and try again.";
    default:
      return fallback;
  }
}

export function formUploadFailure(
  status: number,
  body: { error?: unknown },
): { message: string; code: string } {
  const fromBody = typeof body.error === "string" ? body.error.trim() : "";
  const code =
    fromBody ||
    (status === 413
      ? "FILE_TOO_LARGE"
      : status === 429
        ? "RATE_LIMITED"
        : status === 401 || status === 403 || status === 404
          ? "UNAUTHORIZED"
          : status === 504 || status === 408
            ? "ANALYZE_TIMEOUT"
            : status === 503 || status === 502
              ? "SERVICE_UNAVAILABLE"
              : status === 500
                ? "ANALYZE_FAILED"
                : "UPLOAD_FAILED");
  return {
    code,
    message: formErrorMessage(
      code,
      "That did not finish. Wait a moment and try again.",
    ),
  };
}

export function missingRequiredFields(
  fields: { id: string; label: string; required: boolean; value?: string | boolean }[],
): { id: string; label: string }[] {
  return fields
    .filter((field) => {
      if (!field.required) return false;
      if (typeof field.value === "boolean") return field.value !== true;
      if (typeof field.value === "string") return !field.value.trim();
      return true;
    })
    .map((field) => ({ id: field.id, label: field.label }));
}
