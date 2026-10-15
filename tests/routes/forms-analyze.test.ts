import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAuthContext: vi.fn(),
}));
vi.mock("@/lib/auth/require-identity", () => ({
  requireIdentity: vi.fn(),
}));
vi.mock("@/lib/auth/request-origin", () => ({
  requireRequestOrigin: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("@/lib/forms/pdf-fields", () => ({
  inspectPdfFields: vi.fn(),
}));
vi.mock("@/lib/forms/extract-fields", () => ({
  extractFormFields: vi.fn(),
}));
vi.mock("@/lib/db/form-sessions", () => ({
  createFormSession: vi.fn(),
}));
import { createAuthContext } from "@/lib/supabase/server";
import { requireIdentity } from "@/lib/auth/require-identity";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { inspectPdfFields } from "@/lib/forms/pdf-fields";
import { extractFormFields } from "@/lib/forms/extract-fields";
import { createFormSession } from "@/lib/db/form-sessions";
import { POST } from "@/app/api/forms/analyze/route";

const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3,
]);

const DEFS = [
  { id: "full_name", kind: "text", required: true, initialValue: "" },
];

const INTERPRETED = [
  {
    id: "full_name",
    label: "Full name",
    type: "text",
    required: true,
    prompt: "What is your full name?",
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

function fakeBucket(state: { uploaded: string[]; removed: string[]; failUpload?: boolean }) {
  return {
    upload: vi.fn(async (path: string) => {
      if (state.failUpload) return { error: new Error("disk full") };
      state.uploaded.push(path);
      return { error: null };
    }),
    remove: vi.fn(async (paths: string[]) => {
      state.removed.push(...paths);
      return { error: null };
    }),
  };
}

const bucketState = { uploaded: [] as string[], removed: [] as string[], failUpload: false };

beforeEach(() => {
  bucketState.uploaded.length = 0;
  bucketState.removed.length = 0;
  bucketState.failUpload = false;
  vi.mocked(createAuthContext).mockResolvedValue({
    applyCookies: (response: Response) => response,
  } as never);
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
  vi.mocked(createFormSession).mockImplementation(async (input) => ({
    id: "session-1",
    fileName: input.fileName,
    fields: input.fields,
    currentIndex: 0,
    languageId: input.languageId,
    storagePath: input.storagePath ?? null,
    documentSha256: input.documentSha256 ?? null,
    documentKind: "acroform",
    revision: 1,
    status: "in_progress",
  }) as never);
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
  expect(bucketState.uploaded).toHaveLength(1);
  expect(bucketState.uploaded[0]).toContain("omera-user-1/");
  const created = vi.mocked(createFormSession).mock.calls[0][0] as unknown as Record<string, unknown>;
  expect(created.storagePath).toBe(bucketState.uploaded[0]);
  expect(created.documentSha256).toBe(
    createHash("sha256").update(PDF_BYTES).digest("hex"),
  );
  expect(created.documentKind).toBe("acroform");
});

it("a_malformed_pdf_returns_422", async () => {
  const response = await POST(
    postPdf(new TextEncoder().encode("definitely not a pdf")),
  );
  expect(response.status).toBe(422);
  expect(vi.mocked(inspectPdfFields)).not.toHaveBeenCalled();
  expect(vi.mocked(createFormSession)).not.toHaveBeenCalled();
});

it("a_scan_is_rejected", async () => {
  vi.mocked(inspectPdfFields).mockRejectedValueOnce(
    new Error("NO_FILLABLE_FIELDS"),
  );
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(422);
  expect(await response.json()).toStrictEqual({
    error: "NO_FILLABLE_FIELDS",
  });
  expect(bucketState.uploaded).toHaveLength(0);
  expect(vi.mocked(createFormSession)).not.toHaveBeenCalled();
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

it("an_oversized_file_returns_413", async () => {
  const big = new Uint8Array(4000001);
  big.set(PDF_BYTES);
  const response = await POST(postPdf(big));
  expect(response.status).toBe(413);
  expect(vi.mocked(inspectPdfFields)).not.toHaveBeenCalled();
  expect(vi.mocked(createFormSession)).not.toHaveBeenCalled();
});

it("a_storage_failure_returns_502", async () => {
  bucketState.failUpload = true;
  const response = await POST(postPdf(PDF_BYTES));
  expect(response.status).toBe(502);
  expect(await response.json()).toStrictEqual({
    error: "STORAGE_UPLOAD_FAILED",
  });
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
