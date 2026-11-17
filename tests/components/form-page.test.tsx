// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/context/app-provider", () => ({
  useApp: vi.fn(),
}));

import FormFillPage from "@/app/(platform)/form/page";
import { useApp } from "@/context/app-provider";
import { authAppValue, resetAuthFixture } from "../fixtures/authenticated-app";

const FIELDS = [
  {
    id: "full_name",
    label: "Full name",
    prompt: "What is your full name?",
    required: true,
    kind: "text",
  },
  {
    id: "city",
    label: "City",
    prompt: "Which city do you live in?",
    required: false,
    kind: "text",
  },
];

const BRIEF = {
  title: "Leave application",
  documentKind: "application" as const,
  summary:
    "A staff leave form for municipal employees.\n\nIt records leave dates, a reason, and a manager sign-off before payroll runs.",
  eligibility: "Permanent staff.",
  deadlines: ["Submit before month end"],
  requiredAttachments: ["Leave roster"],
  actionsNow: ["Fill in your name and dates"],
  implications: ["Incomplete forms are returned"],
  fillableSections: ["Applicant details"],
  sections: ["Applicant details", "Leave period", "Approval"],
  keyFacts: ["Leave year 2026"],
  parties: [{ role: "Employer", name: "City of Tshwane" }],
  whatWasRead: {
    pagesRead: 3,
    pageCount: 3,
    truncated: false,
    note: "Omera read all 3 pages that could be extracted as text.",
  },
};

function analyzePayload() {
  return {
    sessionId: "s-1",
    fileName: "form.pdf",
    fields: FIELDS,
    revision: 1,
    status: "in_progress",
    brief: BRIEF,
  };
}

function sessionPayload(currentIndex: number, values: Record<string, string>) {
  return {
    session: {
      id: "s-1",
      fileName: "form.pdf",
      fields: FIELDS.map((field) => ({ ...field, value: values[field.id] })),
      currentIndex,
      languageId: "eng",
      revision: 2,
      status: "in_progress",
      documentKind: "acroform",
      brief: BRIEF,
    },
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function upload() {
  const { container } = render(<FormFillPage />);
  await screen.findByText("Upload your form");
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  fireEvent.change(input, {
    target: {
      files: [new File(["%PDF-1.7"], "form.pdf", { type: "application/pdf" })],
    },
  });
  await screen.findByRole("button", { name: "Start filling" });
  fireEvent.click(screen.getByRole("button", { name: "Start filling" }));
  await screen.findByText("What is your full name?");
}

async function answer(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

beforeEach(() => {
  resetAuthFixture();
  vi.mocked(useApp).mockImplementation(() => authAppValue() as never);
  localStorage.clear();
  if (typeof URL.createObjectURL !== "function") {
    (URL as unknown as Record<string, unknown>).createObjectURL = () => "";
  }
  if (typeof URL.revokeObjectURL !== "function") {
    (URL as unknown as Record<string, unknown>).revokeObjectURL = () => undefined;
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("form page review flow", () => {
  it("shows a human upload error without fillable jargon", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith("/api/forms/analyze")) {
          return jsonResponse({ error: "UNREADABLE_DOCUMENT" }, 422);
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<FormFillPage />);
    await screen.findByText("Upload your form");
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["%PDF-1.7"], "scan.pdf", { type: "application/pdf" })],
      },
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/could not read any text|scan|clearer/i);
    expect(alert.textContent).toMatch(/UNREADABLE_DOCUMENT/);
    expect(alert.textContent).not.toMatch(/password/i);
    expect(alert.textContent).not.toMatch(/acroform/i);
    expect(alert.textContent).not.toMatch(/fillable/i);
  });

  it("shows a distinct size error with the code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith("/api/forms/analyze")) {
          return jsonResponse({ error: "FILE_TOO_LARGE" }, 413);
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<FormFillPage />);
    await screen.findByText("Upload your form");
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["%PDF-1.7"], "huge.pdf", { type: "application/pdf" })],
      },
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/10 MB/i);
    expect(alert.textContent).toMatch(/FILE_TOO_LARGE/);
    expect(alert.textContent).not.toMatch(/password/i);
  });

  it("shows ANALYZE_FAILED for a raw 500 without unlock copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith("/api/forms/analyze")) {
          return new Response("<html>Internal Server Error</html>", {
            status: 500,
            headers: { "Content-Type": "text/html" },
          });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<FormFillPage />);
    await screen.findByText("Upload your form");
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["%PDF-1.7"], "form.pdf", { type: "application/pdf" })],
      },
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/ANALYZE_FAILED/);
    expect(alert.textContent).not.toMatch(/unlock/i);
    expect(alert.textContent).not.toMatch(/print/i);
  });

  it("shows briefing even when analyze omits a brief payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith("/api/forms/analyze")) {
          return jsonResponse(
            {
              sessionId: "s-acro",
              fileName: "Gauteng Tender.pdf",
              fields: FIELDS,
              revision: 1,
              status: "in_progress",
            },
            201,
          );
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<FormFillPage />);
    await screen.findByText("Upload your form");
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(["%PDF-1.7"], "Gauteng Tender.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });
    expect(await screen.findByLabelText("Document briefing")).toBeVisible();
    expect(screen.getByText("Full name")).toBeVisible();
    expect(screen.queryByText("What is your full name?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start filling" }));
    await screen.findByText("What is your full name?");
  });

  it("restores a fresh session onto briefing not questions", async () => {
    localStorage.setItem("omera-form-ref", JSON.stringify({ sessionId: "s-fresh" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        if (target.endsWith("/api/auth/session")) {
          return jsonResponse({ userId: "omera-user-1" }, 200);
        }
        if (target.includes("/api/forms/sessions/s-fresh")) {
          return jsonResponse(
            {
              session: {
                id: "s-fresh",
                fileName: "Gauteng Tender.pdf",
                fields: [
                  {
                    id: "permission",
                    label: "Consent",
                    prompt: "Do you consent?",
                    required: false,
                    kind: "checkbox",
                    value: false,
                  },
                  FIELDS[0],
                ],
                currentIndex: 0,
                languageId: "eng",
                revision: 1,
                status: "in_progress",
                brief: BRIEF,
              },
            },
            200,
          );
        }
        throw new Error(`unexpected fetch: ${target}`);
      }),
    );
    render(<FormFillPage />);
    expect(await screen.findByLabelText("Document briefing")).toBeVisible();
    expect(screen.queryByText("Do you consent?")).toBeNull();
    expect(screen.getByRole("button", { name: "Start filling" })).toBeVisible();
  });

  it("shows a briefing before questions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith("/api/forms/analyze")) {
          return jsonResponse(analyzePayload(), 201);
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<FormFillPage />);
    await screen.findByText("Upload your form");
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["%PDF-1.7"], "form.pdf", { type: "application/pdf" })],
      },
    });
    await screen.findByText(/A staff leave form for municipal employees/i);
    expect(screen.getByText("What you must do now")).toBeVisible();
    expect(screen.getByText("Key facts")).toBeVisible();
    expect(screen.getByText("Parties")).toBeVisible();
    expect(screen.getByText("Outline")).toBeVisible();
    expect(screen.getByText("What Omera read")).toBeVisible();
    expect(screen.getByLabelText("Document briefing")).toHaveClass("overflow-y-auto");
    expect(screen.queryByText("What is your full name?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start filling" }));
    await screen.findByText("What is your full name?");
  });

  it("keeps a fillable form on briefing then Q&A", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith("/api/forms/analyze")) {
          return jsonResponse(analyzePayload(), 201);
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<FormFillPage />);
    await screen.findByText("Upload your form");
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["%PDF-1.7"], "tender.pdf", { type: "application/pdf" })],
      },
    });
    await screen.findByText(/A staff leave form for municipal employees/i);
    expect(screen.getByRole("button", { name: "Start filling" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Start filling" }));
    await screen.findByText("What is your full name?");
  });

  it("summarises a narrative PDF and asks for a form with questions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith("/api/forms/analyze")) {
          return jsonResponse(
            {
              sessionId: "s-narrative",
              fileName: "brochure.pdf",
              fields: [],
              revision: 1,
              status: "in_progress",
              hasFillableQuestions: false,
              brief: {
                ...BRIEF,
                title: "Company brochure",
                documentKind: "other",
                summary: "This PDF is a product brochure about municipal accounting software.",
                fillableSections: [],
              },
            },
            201,
          );
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<FormFillPage />);
    await screen.findByText("Upload your form");
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(["%PDF-1.7"], "brochure.pdf", { type: "application/pdf" }),
        ],
      },
    });
    await screen.findByText(
      "This PDF is a product brochure about municipal accounting software.",
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("What this is about")).toBeVisible();
    expect(screen.getByText(/no fill-in questions/i)).toBeVisible();
    expect(screen.getByText(/Omera found no fill-in questions/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Start filling" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Upload a form with questions" }),
    );
    await screen.findByText("Upload your form");
    expect(screen.queryByText("What is your full name?")).toBeNull();
  });

  it("treats a clerk 404 HTML rewrite as a sign-in problem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith("/api/forms/analyze")) {
          return new Response("<html>404</html>", {
            status: 404,
            headers: { "Content-Type": "text/html" },
          });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<FormFillPage />);
    await screen.findByText("Upload your form");
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["%PDF-1.7"], "form.pdf", { type: "application/pdf" })],
      },
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/sign in/i);
  });

  it("a_save_failure_prevents_advancement", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith("/api/forms/analyze")) {
          return jsonResponse(analyzePayload(), 201);
        }
        return jsonResponse({ error: "REVISION_CONFLICT" }, 409);
      }),
    );
    await upload();
    await answer("Thendo");
    await screen.findByRole("alert");
    // Still on the first question: the save never succeeded.
    expect(screen.getByText("What is your full name?")).toBeVisible();
    expect(screen.queryByText("Which city do you live in?")).toBeNull();
    const urls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => url.includes("/export"))).toHaveLength(0);
  });

  it("the_review_screen_precedes_export", async () => {
    let patches = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith("/api/forms/analyze")) {
          return jsonResponse(analyzePayload(), 201);
        }
        patches += 1;
        return jsonResponse(
          patches === 1
            ? {
                session: sessionPayload(1, { full_name: "Thendo" }).session,
                revision: 2,
              }
            : {
                session: sessionPayload(2, { full_name: "Thendo", city: "Thohoyandou" })
                  .session,
                revision: 3,
              },
          200,
        );
      }),
    );
    await upload();
    await answer("Thendo");
    await screen.findByText("Which city do you live in?");
    await answer("Thohoyandou");
    await screen.findByText("Review your answers");
    expect(
      screen.getByRole("button", { name: "Download completed PDF" }),
    ).toBeVisible();
    const urls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => url.includes("/export"))).toHaveLength(0);
  });

  it("a_refresh_restores_the_session", async () => {
    localStorage.setItem("omera-form-ref", JSON.stringify({ sessionId: "s-9" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        if (target.endsWith("/api/auth/session")) {
          return jsonResponse({ userId: "omera-user-1" }, 200);
        }
        if (target.includes("/api/forms/sessions/s-9")) {
          return jsonResponse(sessionPayload(0, {}), 200);
        }
        throw new Error(`unexpected fetch: ${target}`);
      }),
    );
    render(<FormFillPage />);
    await screen.findByRole("button", { name: "Start filling" });
    fireEvent.click(screen.getByRole("button", { name: "Start filling" }));
    await screen.findByText("What is your full name?");
    // Only the session reference is stored locally — never form answers.
    const stored = JSON.parse(
      localStorage.getItem("omera-form-ref") ?? "{}",
    ) as Record<string, unknown>;
    expect(stored).toStrictEqual({ sessionId: "s-9" });
  });

  it("the_download_button_returns_a_pdf", async () => {
    let patches = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        if (target.endsWith("/api/forms/analyze")) {
          return jsonResponse(analyzePayload(), 201);
        }
        if (target.endsWith("/export")) {
          return new Response(new TextEncoder().encode("%PDF-1.7 filled"), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition":
                'attachment; filename="form-completed.pdf"',
            },
          });
        }
        patches += 1;
        return jsonResponse(
          patches === 1
            ? {
                session: sessionPayload(1, { full_name: "Thendo" }).session,
                revision: 2,
              }
            : {
                session: sessionPayload(2, {
                  full_name: "Thendo",
                  city: "Thohoyandou",
                }).session,
                revision: 3,
              },
          200,
        );
      }),
    );
    const created: string[] = [];
    URL.createObjectURL = vi.fn((blob: unknown) => {
      created.push((blob as Blob).type);
      return "blob:mock-pdf";
    }) as unknown as typeof URL.createObjectURL;
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        clicked.push(this.download);
      },
    );
    await upload();
    await answer("Thendo");
    await screen.findByText("Which city do you live in?");
    await answer("Thohoyandou");
    const download = await screen.findByRole("button", {
      name: "Download completed PDF",
    });
    fireEvent.click(download);
    await screen.findByText("Your completed PDF has downloaded.");
    expect(created).toEqual(["application/pdf"]);
    expect(clicked).toEqual(["form-completed.pdf"]);
  });

  it("discards the session from briefing and from questions so a new PDF starts clean", async () => {
    let uploads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith("/api/forms/analyze")) {
          uploads += 1;
          if (uploads < 3) return jsonResponse(analyzePayload(), 201);
          return jsonResponse(
            {
              ...analyzePayload(),
              sessionId: "s-2",
              fileName: "other.pdf",
              fields: [
                {
                  id: "csd",
                  label: "CSD number",
                  prompt: "CSD number",
                  required: true,
                  kind: "text",
                },
              ],
            },
            201,
          );
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<FormFillPage />);
    await screen.findByText("Upload your form");
    const input = () =>
      container.querySelector('input[type="file"]') as HTMLInputElement;
    const choose = (name: string) => {
      fireEvent.change(input(), {
        target: {
          files: [new File(["%PDF-1.7"], name, { type: "application/pdf" })],
        },
      });
    };

    choose("form.pdf");
    await screen.findByRole("button", { name: "Start filling" });
    fireEvent.click(screen.getAllByRole("button", { name: "Upload another" })[0]);
    await screen.findByText("Upload your form");
    expect(screen.queryByText("What is your full name?")).toBeNull();
    expect(localStorage.getItem("omera-form-ref")).toBeNull();

    choose("form.pdf");
    await screen.findByRole("button", { name: "Start filling" });
    fireEvent.click(screen.getByRole("button", { name: "Start filling" }));
    await screen.findByText("What is your full name?");
    fireEvent.click(screen.getAllByRole("button", { name: "Replace document" })[0]);
    await screen.findByText("Upload your form");
    expect(screen.queryByText("What is your full name?")).toBeNull();
    expect(localStorage.getItem("omera-form-ref")).toBeNull();

    choose("other.pdf");
    await screen.findByRole("button", { name: "Start filling" });
    fireEvent.click(screen.getByRole("button", { name: "Start filling" }));
    expect((await screen.findAllByText("CSD number")).length).toBeGreaterThan(0);
    expect(screen.queryByText("What is your full name?")).toBeNull();
    expect(localStorage.getItem("omera-form-ref")).toContain("s-2");
  });
});
