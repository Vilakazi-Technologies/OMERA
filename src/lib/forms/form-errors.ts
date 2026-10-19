/** User-facing copy for form API error codes. */
export function formErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "NO_FILLABLE_FIELDS":
      return "This PDF has no fillable fields. Use a PDF prepared with form fields (AcroForm), not a flat scan.";
    case "UNSUPPORTED_XFA":
      return "This PDF uses a format we cannot fill yet (XFA). Try a standard fillable PDF.";
    case "SIGNATURE_REQUIRES_REVIEW":
      return "This form includes signature fields. Complete other fields and review signatures manually.";
    case "FORM_TRANSLATION_FAILED":
      return "Omera could not read field labels (AI busy). Try again in a moment.";
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
      return "PDF is too large (max 4 MB). Use a smaller file.";
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
