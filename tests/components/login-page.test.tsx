// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));
vi.mock("@/context/app-provider", () => ({
  useApp: () => ({
    setUserId: vi.fn(),
    setPersistence: vi.fn(),
    refreshConversations: vi.fn(async () => undefined),
  }),
}));
vi.mock("@/components/omera-wordmark", () => ({
  OmeraWordmark: () => <span>Omera</span>,
}));
import LoginPage from "@/app/login/page";

const pushMock = vi.fn();
const replaceMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(impl: (input: unknown) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("login page", () => {
  it("a_network_failure_does_not_enter_chat", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("you@company.co.za"), {
      target: { value: "a@b.co" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/try again/i);
    expect(pushMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Send code" }),
    ).not.toBeDisabled();
  });

  it("an_invalid_otp_shows_a_neutral_error", async () => {
    stubFetch(async (input) => {
      const url = String(input);
      if (url === "/api/auth/verify") {
        const calls = vi.mocked(fetch).mock.calls.length;
        if (calls === 1) return jsonResponse({ ok: true }, 200);
        return jsonResponse({ error: "INVALID_CODE" }, 401);
      }
      return jsonResponse({ error: "UNAUTHORIZED" }, 401);
    });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("you@company.co.za"), {
      target: { value: "a@b.co" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    const codeInput = await screen.findByPlaceholderText("123456");
    fireEvent.change(codeInput, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/invalid or expired/i);
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Verify" })).not.toBeDisabled();
  });
});
