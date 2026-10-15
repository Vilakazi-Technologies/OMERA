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

function analyzePayload() {
  return {
    sessionId: "s-1",
    fileName: "form.pdf",
    fields: FIELDS,
    revision: 1,
    status: "in_progress",
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
});
