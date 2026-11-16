/** User-facing copy for form API error codes. */
export function formErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "NO_FILLABLE_FIELDS":
    case "UNREADABLE_DOCUMENT":
      return "Omera could not read this PDF. It may be a faint scan, a photo of pages, or empty. Export a clearer text PDF (Print to PDF), or photograph each page in good light, then upload again.";
    case "PDF_PAGE_LIMIT":
      return "This PDF is longer than Omera can fill in place (40 pages). Upload the returnable forms section, or a pack of at most 80 pages so Omera can still brief you and add an answers page.";
    case "INVALID_PDF_SIZE":
      return "This PDF is larger than the 4 MB upload limit. Compress it or export a smaller copy, then try again.";
    case "ENCRYPTED_PDF":
      return "This PDF is password-protected. Remove the password in your PDF app (unlock it), then upload the copy.";
    case "UNSUPPORTED_XFA":
      return "This PDF uses a special form format we cannot complete yet. Export it as a regular PDF from Adobe or your browser, then upload that file.";
    case "FORM_INFERENCE_FAILED":
    case "CHAT_UNAVAILABLE":
      return "Omera could not read this form right now (the AI is busy). Wait a moment and try again.";
    case "FORM_TRANSLATION_FAILED":
      return "Omera could not read the field labels right now. Wait a moment and try again.";
    case "MALFORMED_PDF":
    case "INVALID_PDF":
      return "This file does not look like a usable PDF. Try exporting or printing it to PDF again.";
    case "FORMS_STORAGE_UNAVAILABLE":
      return "Form storage is not configured on the server. Supabase is required for upload and export.";
    case "STORAGE_UPLOAD_FAILED":
    case "SESSION_CREATE_FAILED":
      return "Could not save your form on the server. Check Supabase configuration and try again.";
    case "INCOMPLETE_FORM":
    case "MISSING_REQUIRED_VALUE":
    case "REQUIRED_FIELD":
      return "Some required fields are still empty. Complete every required answer, then download again.";
    case "UNSUPPORTED_CHARACTER":
      return "An answer uses characters this PDF font cannot display. Try simpler spelling or English for that field.";
    case "FILE_TOO_LARGE":
      return "This PDF is larger than 4 MB. Compress it or split the tender pack, then upload again.";
    case "UNAUTHORIZED":
      return "Sign in to Omera, then upload your form again.";
    case "ORIGIN_FORBIDDEN":
      return "This session could not be verified. Refresh the page, sign in, and try again.";
    case "QUOTA_EXCEEDED":
      return "Too many requests right now. Wait a minute and try again.";
    case "SERVICE_UNAVAILABLE":
      return "Omera is temporarily unavailable. Check AI keys on Vercel and try again.";
    default:
      return fallback;
  }
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
