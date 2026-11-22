import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-identity", () => ({
  requireIdentity: vi.fn(),
}));
vi.mock("@/lib/auth/request-origin", () => ({
  requireRequestOrigin: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
  isSupabaseConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/forms/pdf-fields", () => ({
  inspectPdfFields: vi.fn(),
}));
vi.mock("@/lib/forms/extract-fields", () => ({
  extractFormFields: vi.fn(),
}));
vi.mock("@/lib/forms/infer-form-fields", () => ({
  inferFormFieldsFromDocument: vi.fn(),
}));
vi.mock("@/lib/forms/pdf-text", () => ({
  extractPdfDocument: vi.fn(),
}));
vi.mock("@/lib/forms/document-brief", () => ({
  buildDocumentBrief: vi.fn(),
}));
vi.mock("@/lib/db/form-sessions", () => ({
  createFormSession: vi.fn(),
}));
vi.mock("@/lib/limits/rate-limit", () => ({
  allowRequest: vi.fn(() => true),
}));
import { requireIdentity } from "@/lib/auth/require-identity";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { inspectPdfFields } from "@/lib/forms/pdf-fields";
import { extractFormFields } from "@/lib/forms/extract-fields";
import { inferFormFieldsFromDocument } from "@/lib/forms/infer-form-fields";
import { extractPdfDocument } from "@/lib/forms/pdf-text";
import { buildDocumentBrief } from "@/lib/forms/document-brief";
import { createFormSession, type StoredFormField } from "@/lib/db/form-sessions";
import { POST } from "@/app/api/forms/analyze/route";

const BRIEF = {
  title: "Leave application",
  documentKind: "application" as const,
  summary: "Staff leave form.",
  eligibility: "Employees.",
  deadlines: [],
  requiredAttachments: [],
  actionsNow: ["Complete the applicant details."],
  implications: [],
  fillableSections: ["Applicant details"],
  sections: ["Applicant details"],
  keyFacts: [],
  parties: [],
  whatWasRead: {
    pagesRead: 1,
    pageCount: 1,
    truncated: false,
    note: "Omera read all 1 page that could be extracted as text.",
  },
};

const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3,
]);

const PRIVACY_MARKER = "SECRET_MARKER_analyze_7c2e";

const DEFS = [
  { id: "full_name", kind: "text", required: true, initialValue: "" },
];

const INTERPRETED: StoredFormField[] = [
  {
    id: "full_name",
    label: "Full name",
    type: "text",
    required: true,
    prompt: "What should I enter for Full name?",
    kind: "text",
  },
];

function postPdf(
  bytes: Uint8Array,
  options: { fileName?: string; mime?: string; languageId?: string } = {},
): Request {
  const form = new FormData();
  form.append(
    "file",
    new File([bytes as unknown as BlobPart], options.fileName ?? "form.pdf", {
      type: options.mime ?? "application/pdf",
    }),
  );
  if (options.languageId) form.append("languageId", options.languageId);
  return new Request("https://omera.example/api/forms/analyze", {
    method: "POST",
    body: form,
  });
}

function fakeBucket(state: {
  uploaded: string[];
  removed: string[];
  failUpload?: boolean;
  uploadError?: unknown;
}) {
  return {
    upload: vi.fn(async (path: string) => {
      if (state.failUpload) {
        return { error: state.uploadError ?? new Error("disk full") };
      }
      state.uploaded.push(path);
      return { error: null };
    }),
    remove: vi.fn(async (paths: string[]) => {
      state.removed.push(...paths);
      return { error: null };
    }),
  };
}

const bucketState = {
  uploaded: [] as string[],
  removed: [] as string[],
  failUpload: false,
  uploadError: undefined as unknown,
};

beforeEach(() => {
  bucketState.uploaded.length = 0;
  bucketState.removed.length = 0;
  bucketState.failUpload = false;
  bucketState.uploadError = undefined;
  vi.mocked(requireIdentity).mockResolvedValue({
    userId: "omera-user-1",
    authUserId: "auth-1",
  } as never);
  vi.mocked(requireRequestOrigin).mockReturnValue(undefined);
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    storage: { from: () => fakeBucket(bucketState) },
  } as never);
  vi.mocked(inspectPdfFields).mockResolvedValue(DEFS as never);
  vi.mocked(extractFormFields).mockResolvedValue(INTERPRETED as never);
  vi.mocked(inferFormFieldsFromDocument).mockReset();
  vi.mocked(extractPdfDocument).mockResolvedValue({
    pages: [{ pageNumber: 1, text: "Full name: ______" }],
    text: "Full name: ______",
    totalPages: 1,
    truncated: false,
  });
  vi.mocked(buildDocumentBrief).mockResolvedValue(BRIEF);
  vi.mocked(createFormSession).mockImplementation(async (input) => ({
    id: "session-1",
    fileName: input.fileName,
    fields: input.fields,
    currentIndex: 0,
    languageId: input.languageId,
    storagePath: input.storagePath ?? null,
    documentSha256: input.documentSha256 ?? null,
    documentKind: input.documentKind ?? "acroform",
    revision: 1,
    status: "in_progress",
    brief: input.brief ?? BRIEF,
  }) as never);
});

it("passes language and page coverage into the briefing", async () => {
  vi.mocked(extractPdfDocument).mockResolvedValueOnce({
    pages: Array.from({ length: 80 }, (_, index) => ({
      pageNumber: index + 1,
      text: "tender",
    })),
    text: "Invitation to tender",
    totalPages: 120,
    truncated: true,
  });
  const response = await POST(postPdf(PDF_BYTES, { languageId: "zul" }));
  expect(response.status).toBe(201);
  expect(vi.mocked(buildDocumentBrief).mock.calls[0][1]).toMatchObject({
    languageId: "zul",
    pagesRead: 80,
    pageCount: 120,
    truncated: true,
  });
});

it("acroform_analyze_returns_brief_and_fields", async () => {
  const response = await POST(postPdf(PDF_BYTES, { fileName: "gauteng-tender.pdf" }));
  expect(response.status).toBe(201);
  const body = (await response.json()) as {
    brief: unknown;
    fields: unknown[];
    hasFillableQuestions: boolean;
  };
  expect(body.brief).toEqual(BRIEF);
  expect(body.fields).toStrictEqual(INTERPRETED);
  expect(body.hasFillableQuestions).toBe(true);
  expect(vi.mocked(buildDocumentBrief)).toHaveBeenCalled();
  expect(vi.mocked(buildDocumentBrief).mock.calls[0][1]).toMatchObject({
    fileName: "gauteng-tender.pdf",
    fields: [{ label: "Full name", kind: "text" }],
  });
});

it("still_returns_a_heuristic_brief_when_brief_ai_throws", async () => {
  vi.mocked(buildDocumentBrief).mockRejectedValueOnce(new Error("CHAT_UNAVAILABLE"));
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(201);
  const body = (await response.json()) as { brief: { summary?: string; title?: string } };
  expect(body.brief?.title ?? body.brief?.summary).toBeTruthy();
  const created = vi.mocked(createFormSession).mock.calls.at(-1)?.[0] as {
    brief: { summary: string; fillableSections: string[] };
  };
  expect(created.brief.summary).toMatch(/Full name|fill-in question/i);
});

it("a_valid_pdf_creates_a_session", async () => {
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(201);
  const body = (await response.json()) as {
    sessionId: string;
    fields: unknown[];
    revision: number;
    status: string;
  };
  expect(body.sessionId).toBe("session-1");
  expect(body.fields).toStrictEqual(INTERPRETED);
  expect(body.revision).toBe(1);
  expect(body.status).toBe("in_progress");
  expect(
    (body as { hasFillableQuestions?: boolean }).hasFillableQuestions,
  ).toBe(true);
  expect(bucketState.uploaded).toHaveLength(1);
  expect(bucketState.uploaded[0]).toContain("omera-user-1/");
  const created = vi.mocked(createFormSession).mock.calls[0][0] as unknown as Record<string, unknown>;
  expect(created.storagePath).toBe(bucketState.uploaded[0]);
  expect(created.documentSha256).toBe(
    createHash("sha256").update(PDF_BYTES).digest("hex"),
  );
  expect(created.documentKind).toBe("acroform");
  expect(created.brief).toEqual(BRIEF);
});

it("a_malformed_pdf_returns_422", async () => {
  const response = await POST(
    postPdf(new TextEncoder().encode("definitely not a pdf")),
  );
  expect(response.status).toBe(422);
  expect(vi.mocked(inspectPdfFields)).not.toHaveBeenCalled();
  expect(vi.mocked(createFormSession)).not.toHaveBeenCalled();
});

it("a_scan_falls_back_to_inference_when_ai_finds_fields", async () => {
  vi.mocked(inspectPdfFields).mockRejectedValueOnce(
    new Error("NO_FILLABLE_FIELDS"),
  );
  vi.mocked(inferFormFieldsFromDocument).mockResolvedValueOnce(INTERPRETED);
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(201);
  const created = vi.mocked(createFormSession).mock.calls[0][0] as {
    documentKind: string;
  };
  expect(created.documentKind).toBe("flat");
});

it("a_valid_pdf_with_no_blanks_still_starts_a_session", async () => {
  vi.mocked(inspectPdfFields).mockRejectedValueOnce(
    new Error("NO_FILLABLE_FIELDS"),
  );
  vi.mocked(inferFormFieldsFromDocument).mockResolvedValueOnce([]);
  vi.mocked(extractPdfDocument).mockResolvedValueOnce({
    pages: [],
    text: "",
    totalPages: 1,
    truncated: false,
  });
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(201);
  const body = (await response.json()) as {
    hasFillableQuestions: boolean;
    fields: unknown[];
    message: string;
  };
  const created = vi.mocked(createFormSession).mock.calls[0][0] as {
    fields: { id: string }[];
  };
  expect(created.fields).toEqual([]);
  expect(body.fields).toEqual([]);
  expect(body.hasFillableQuestions).toBe(false);
  expect(body.message).toMatch(/no fill-in blanks/i);
  expect(bucketState.uploaded).toHaveLength(1);
});

it("a_long_pack_without_acroform_is_inferred_not_rejected", async () => {
  vi.mocked(inspectPdfFields).mockRejectedValueOnce(
    new Error("PDF_PAGE_LIMIT"),
  );
  vi.mocked(inferFormFieldsFromDocument).mockResolvedValueOnce(INTERPRETED);
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(201);
  const created = vi.mocked(createFormSession).mock.calls[0][0] as {
    documentKind: string;
    brief: unknown;
  };
  expect(created.documentKind).toBe("flat");
  expect(created.brief).toEqual(BRIEF);
});

it("readable_text_with_no_blanks_still_creates_a_briefing_session", async () => {
  vi.mocked(inspectPdfFields).mockRejectedValueOnce(
    new Error("NO_FILLABLE_FIELDS"),
  );
  vi.mocked(inferFormFieldsFromDocument).mockResolvedValueOnce([]);
  vi.mocked(extractPdfDocument).mockResolvedValueOnce({
    pages: [{ pageNumber: 1, text: "Invitation to tender for accounting services. Closing date 12 December 2026." }],
    text: "Invitation to tender for accounting services. Closing date 12 December 2026.",
    totalPages: 12,
    truncated: false,
  });
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(201);
  const created = vi.mocked(createFormSession).mock.calls[0][0] as {
    fields: { id: string }[];
    brief: unknown;
  };
  expect(created.brief).toEqual(BRIEF);
  expect(created.fields).toEqual([]);
  const body = (await response.json()) as {
    hasFillableQuestions: boolean;
    message: string;
  };
  expect(body.hasFillableQuestions).toBe(false);
  expect(body.message).toMatch(/no fill-in blanks/i);
});

it("an_encrypted_pdf_is_rejected_without_inference", async () => {
  vi.mocked(inspectPdfFields).mockRejectedValueOnce(new Error("ENCRYPTED_PDF"));
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(422);
  expect(await response.json()).toStrictEqual({ error: "ENCRYPTED_PDF" });
  expect(vi.mocked(inferFormFieldsFromDocument)).not.toHaveBeenCalled();
});

it("inference_busy_still_starts_a_briefing_session_without_invented_questions", async () => {
  vi.mocked(inspectPdfFields).mockRejectedValueOnce(
    new Error("NO_FILLABLE_FIELDS"),
  );
  vi.mocked(inferFormFieldsFromDocument).mockRejectedValueOnce(
    new Error("FORM_INFERENCE_FAILED"),
  );
  vi.mocked(extractPdfDocument).mockResolvedValueOnce({
    pages: [{ pageNumber: 1, text: "Invitation to tender. Evaluation criteria are listed below." }],
    text: "Invitation to tender. Evaluation criteria are listed below.",
    totalPages: 1,
    truncated: false,
  });
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(201);
  const created = vi.mocked(createFormSession).mock.calls[0][0] as {
    fields: { id: string }[];
    brief: unknown;
  };
  expect(created.fields).toEqual([]);
  expect(created.brief).toEqual(BRIEF);
});

it("acroform_widgets_still_pick_up_printed_blanks", async () => {
  vi.mocked(extractPdfDocument).mockResolvedValueOnce({
    pages: [
      {
        pageNumber: 1,
        text: "Full name: (widget)\nCSD number: ______\nSignature: ______",
      },
    ],
    text: "Full name: (widget)\nCSD number: ______\nSignature: ______",
    totalPages: 1,
    truncated: false,
  });
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(201);
  const created = vi.mocked(createFormSession).mock.calls.at(-1)?.[0] as {
    fields: { id: string; label: string; kind?: string }[];
  };
  expect(created.fields.find((field) => field.id === "full_name")).toBeTruthy();
  expect(created.fields.map((field) => field.label).join(" ")).toMatch(/CSD/i);
  expect(created.fields.some((field) => field.kind === "signature")).toBe(true);
});

it("an_unsupported_format_returns_415", async () => {
  const response = await POST(
    postPdf(new TextEncoder().encode("hello"), {
      fileName: "notes.txt",
      mime: "text/plain",
    }),
  );
  expect(response.status).toBe(415);
  expect(vi.mocked(inspectPdfFields)).not.toHaveBeenCalled();
});

it("a_long_pack_with_too_many_acroform_fields_is_inferred_not_rejected", async () => {
  vi.mocked(inspectPdfFields).mockRejectedValueOnce(
    new Error("PDF_FIELD_LIMIT"),
  );
  vi.mocked(inferFormFieldsFromDocument).mockResolvedValueOnce(INTERPRETED);
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(201);
  expect(vi.mocked(inferFormFieldsFromDocument)).toHaveBeenCalled();
});

it("an_oversized_file_returns_413", async () => {
  const { FORM_PDF_FILE_LIMIT } = await import("@/lib/forms/pdf-limits");
  const big = new Uint8Array(FORM_PDF_FILE_LIMIT + 1);
  big.set(PDF_BYTES);
  const response = await POST(postPdf(big));
  expect(response.status).toBe(413);
  expect(vi.mocked(inspectPdfFields)).not.toHaveBeenCalled();
  expect(vi.mocked(createFormSession)).not.toHaveBeenCalled();
});

it("a_storage_failure_returns_502", async () => {
  bucketState.failUpload = true;
  bucketState.uploadError = new Error(PRIVACY_MARKER);
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(502);
  expect(await response.json()).toStrictEqual({
    error: "STORAGE_UPLOAD_FAILED",
  });
  expect(spy.mock.calls.flat().map(String).join(" ")).not.toContain(PRIVACY_MARKER);
  expect(vi.mocked(createFormSession)).not.toHaveBeenCalled();
  spy.mockRestore();
});

it("a_bucket_size_limit_returns_413", async () => {
  bucketState.failUpload = true;
  bucketState.uploadError = {
    message: "The object exceeded the maximum allowed size",
    statusCode: 413,
  };
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(413);
  expect(await response.json()).toStrictEqual({ error: "FILE_TOO_LARGE" });
  expect(vi.mocked(createFormSession)).not.toHaveBeenCalled();
});

it("a_database_failure_returns_502", async () => {
  vi.mocked(createFormSession).mockRejectedValueOnce(
    new Error("db unavailable"),
  );
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(502);
  // The orphaned upload is cleaned up when the session write fails.
  expect(bucketState.uploaded).toHaveLength(1);
  expect(bucketState.removed).toEqual(bucketState.uploaded);
});

it("pdf_extract_failure_keeps_the_error_cause_out_of_the_log", async () => {
  const cause = new Error(PRIVACY_MARKER);
  vi.mocked(extractPdfDocument).mockRejectedValueOnce(
    Object.assign(new Error("MALFORMED_PDF"), { cause }),
  );
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(201);
  expect(spy.mock.calls.flat().map(String).join(" ")).not.toContain(PRIVACY_MARKER);
  spy.mockRestore();
});

it("an_unexpected_error_keeps_its_message_out_of_the_log", async () => {
  vi.mocked(requireIdentity).mockRejectedValueOnce(new Error(PRIVACY_MARKER));
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(503);
  expect(await response.json()).toStrictEqual({ error: "SERVICE_UNAVAILABLE" });
  expect(spy.mock.calls.flat().map(String).join(" ")).not.toContain(PRIVACY_MARKER);
  spy.mockRestore();
});
