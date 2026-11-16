import { expect, it } from "vitest";
import { formErrorMessage, formUploadFailure } from "@/lib/forms/form-errors";

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
    "REQUEST_TOO_LARGE",
    "RATE_LIMITED",
    "SESSION_CREATE_FAILED",
    "ANALYZE_TIMEOUT",
  ];
  for (const code of codes) {
    const message = formErrorMessage(code, "fallback");
    expect(message).not.toMatch(/acroform/i);
    expect(message).not.toMatch(/fillable/i);
    expect(message.length).toBeGreaterThan(20);
  }
});

it("keeps scan, password, size, AI, storage, and sign-in as distinct copy", () => {
  const scan = formErrorMessage("UNREADABLE_DOCUMENT", "fallback");
  const password = formErrorMessage("ENCRYPTED_PDF", "fallback");
  const size = formErrorMessage("FILE_TOO_LARGE", "fallback");
  const ai = formErrorMessage("FORM_INFERENCE_FAILED", "fallback");
  const storage = formErrorMessage("SESSION_CREATE_FAILED", "fallback");
  const signIn = formErrorMessage("UNAUTHORIZED", "fallback");
  const messages = [scan, password, size, ai, storage, signIn];
  expect(new Set(messages).size).toBe(6);
  expect(scan).toMatch(/scan|text/i);
  expect(scan).not.toMatch(/password/i);
  expect(password).toMatch(/password/i);
  expect(password).not.toMatch(/4\.5 MB|10 MB/i);
  expect(size).toMatch(/10 MB/i);
  expect(ai).toMatch(/AI is busy/i);
  expect(storage).toMatch(/database|storage/i);
  expect(signIn).toMatch(/sign in/i);
});

it("maps HTML platform failures to a real code instead of the old combined fallback", () => {
  expect(formUploadFailure(413, {}).code).toBe("FILE_TOO_LARGE");
  expect(formUploadFailure(504, {}).code).toBe("ANALYZE_TIMEOUT");
  expect(formUploadFailure(502, {}).code).toBe("SERVICE_UNAVAILABLE");
  expect(formUploadFailure(500, {}).code).toBe("ANALYZE_FAILED");
  expect(formUploadFailure(429, {}).code).toBe("RATE_LIMITED");
  expect(formUploadFailure(422, { error: "UNREADABLE_DOCUMENT" }).code).toBe(
    "UNREADABLE_DOCUMENT",
  );
  expect(formUploadFailure(502, { error: "SESSION_CREATE_FAILED" }).message).toMatch(
    /database|storage/i,
  );
  expect(formErrorMessage("UPLOAD_FAILED", "fallback")).not.toMatch(
    /unlock|print/i,
  );
  expect(formErrorMessage("ANALYZE_FAILED", "fallback")).not.toMatch(
    /unlock|print/i,
  );
});

it("uses a human fallback without fillable jargon", () => {
  expect(formErrorMessage("WEIRD", "Omera could not finish this upload.")).toBe(
    "Omera could not finish this upload.",
  );
});
