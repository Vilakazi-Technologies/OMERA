import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAuthContext: vi.fn(),
}));
vi.mock("@/lib/auth/require-identity", () => ({
  requireIdentity: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("@/lib/db/form-sessions", () => ({
  getFormSession: vi.fn(),
  updateFormSession: vi.fn(),
}));
import { createAuthContext } from "@/lib/supabase/server";
import { requireIdentity } from "@/lib/auth/require-identity";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getFormSession, updateFormSession } from "@/lib/db/form-sessions";
import type { FormSessionRecord } from "@/lib/db/form-sessions";
import { GET } from "@/app/api/forms/sessions/[id]/export/route";

const SESSION_ID = "session-1";

async function fixturePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  const form = pdf.getForm();
  const name = form.createTextField("full_name");
  name.enableRequired();
  name.addToPage(page, { x: 40, y: 700, width: 350, height: 24 });
  const method = form.createDropdown("method");
  method.addOptions(["Email", "Phone"]);
  method.addToPage(page, { x: 40, y: 600, width: 200, height: 24 });
  return pdf.save();
}

function sessionFor(
  bytes: Uint8Array,
  values: { full_name?: string; method?: string },
): FormSessionRecord {
  return {
    id: SESSION_ID,
    fileName: "my form (1).pdf",
    storagePath: "omera-user-1/session-1/my_form.pdf",
    fields: [
      {
        id: "full_name",
        label: "Full name",
        type: "text",
        required: true,
        prompt: "What is your full name?",
        kind: "text",
        value: values.full_name,
      },
      {
        id: "method",
        label: "Contact method",
        type: "text",
        required: false,
        prompt: "How should we contact you?",
        kind: "choice",
        options: ["Email", "Phone"],
        value: values.method ?? "",
      },
    ],
    currentIndex: 2,
    languageId: "eng",
    documentSha256: createHash("sha256").update(bytes).digest("hex"),
    documentKind: "acroform",
    revision: 4,
    status: "review",
  };
}

function downloadFor(bytes: Uint8Array | null) {
  return {
    storage: {
      from: () => ({
        download: async () =>
          bytes
            ? { data: new Blob([bytes as unknown as BlobPart]), error: null }
            : { data: null, error: new Error("not found") },
      }),
    },
  } as never;
}

function getRequest(): Request {
  return new Request(
    `https://omera.example/api/forms/sessions/${SESSION_ID}/export`,
  );
}

const params = { params: Promise.resolve({ id: SESSION_ID }) };

beforeEach(() => {
  vi.mocked(createAuthContext).mockResolvedValue({
    applyCookies: (response: Response) => response,
  } as never);
  vi.mocked(requireIdentity).mockResolvedValue({
    userId: "omera-user-1",
    authUserId: "auth-1",
  } as never);
  vi.mocked(updateFormSession).mockImplementation(
    async () => ({}) as never,
  );
});

it("a_completed_session_returns_a_pdf", async () => {
  const source = await fixturePdf();
  vi.mocked(getFormSession).mockResolvedValueOnce(
    sessionFor(source, { full_name: "Thendo", method: "Email" }),
  );
  vi.mocked(getSupabaseAdmin).mockReturnValueOnce(downloadFor(source));
  const response = await GET(getRequest(), params);
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/pdf");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const disposition = response.headers.get("Content-Disposition") ?? "";
  expect(disposition).toContain("attachment");
  expect(disposition).toContain("-completed.pdf");
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  expect(vi.mocked(updateFormSession)).toHaveBeenCalledWith(
    SESSION_ID,
    "omera-user-1",
    { status: "completed" },
  );
});

it("the_pdf_contains_the_filled_values", async () => {
  const source = await fixturePdf();
  vi.mocked(getFormSession).mockResolvedValueOnce(
    sessionFor(source, { full_name: "Thendo", method: "Phone" }),
  );
  vi.mocked(getSupabaseAdmin).mockReturnValueOnce(downloadFor(source));
  const response = await GET(getRequest(), params);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const filled = await PDFDocument.load(bytes);
  expect(filled.getPageCount()).toBe(1);
  expect(filled.getPages()[0].getSize()).toEqual({ width: 600, height: 800 });
  expect(filled.getForm().getFields().map((field) => field.getName())).toEqual(
    ["full_name", "method"],
  );
  expect(filled.getForm().getTextField("full_name").getText()).toBe("Thendo");
  expect(filled.getForm().getDropdown("method").getSelected()).toEqual([
    "Phone",
  ]);
});

it("a_missing_object_returns_404", async () => {
  const source = await fixturePdf();
  vi.mocked(getFormSession).mockResolvedValueOnce(
    sessionFor(source, { full_name: "Thendo" }),
  );
  vi.mocked(getSupabaseAdmin).mockReturnValueOnce(downloadFor(null));
  const response = await GET(getRequest(), params);
  expect(response.status).toBe(404);
  expect(await response.json()).toStrictEqual({ error: "OBJECT_NOT_FOUND" });
});

it("another_users_session_returns_404", async () => {
  vi.mocked(getFormSession).mockResolvedValueOnce(null);
  const response = await GET(getRequest(), params);
  expect(response.status).toBe(404);
  expect(vi.mocked(getFormSession)).toHaveBeenCalledWith(
    SESSION_ID,
    "omera-user-1",
  );
});

it("a_failed_fill_keeps_the_session_in_review", async () => {
  // The flow is complete first: every required field answered, session in
  // review. The fill then fails on its own (bytes the filler rejects),
  // proving the failure path independent of completeness validation.
  const corrupt = new TextEncoder().encode("not a pdf at all");
  vi.mocked(getFormSession).mockResolvedValueOnce(
    sessionFor(corrupt, { full_name: "Thendo", method: "Email" }),
  );
  vi.mocked(getSupabaseAdmin).mockReturnValueOnce(downloadFor(corrupt));
  const response = await GET(getRequest(), params);
  expect(response.status).toBe(422);
  expect(await response.json()).toStrictEqual({ error: "INVALID_PDF" });
  expect(vi.mocked(updateFormSession)).toHaveBeenCalledWith(
    SESSION_ID,
    "omera-user-1",
    { status: "review" },
  );
});

it("an_incomplete_session_is_rejected_before_filling", async () => {
  const source = await fixturePdf();
  vi.mocked(getFormSession).mockResolvedValueOnce(
    sessionFor(source, { full_name: "" }),
  );
  vi.mocked(getSupabaseAdmin).mockReturnValueOnce(downloadFor(source));
  const response = await GET(getRequest(), params);
  expect(response.status).toBe(422);
  expect(await response.json()).toStrictEqual({
    error: "MISSING_REQUIRED_VALUE",
  });
  expect(vi.mocked(updateFormSession)).toHaveBeenCalledWith(
    SESSION_ID,
    "omera-user-1",
    { status: "review" },
  );
});
