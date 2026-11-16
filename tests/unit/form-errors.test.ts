import { expect, it } from "vitest";
import { formErrorMessage } from "@/lib/forms/form-errors";

it("never mentions AcroForm or fillable jargon", () => {
  const codes = [
    "NO_FILLABLE_FIELDS",
    "UNREADABLE_DOCUMENT",
    "ENCRYPTED_PDF",
    "UNSUPPORTED_XFA",
    "FORM_INFERENCE_FAILED",
    "MALFORMED_PDF",
    "UNAUTHORIZED",
    "PDF_PAGE_LIMIT",
    "FILE_TOO_LARGE",
    "ENCRYPTED_PDF",
  ];
  for (const code of codes) {
    const message = formErrorMessage(code, "fallback");
    expect(message).not.toMatch(/acroform/i);
    expect(message).not.toMatch(/fillable/i);
    expect(message.length).toBeGreaterThan(20);
  }
});

it("uses a human fallback without fillable jargon", () => {
  expect(formErrorMessage("WEIRD", "Omera could not read this PDF.")).toBe(
    "Omera could not read this PDF.",
  );
});
