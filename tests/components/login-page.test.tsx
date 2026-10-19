// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
vi.mock("@clerk/nextjs", () => ({
  SignIn: () => <div data-testid="clerk-sign-in">Clerk sign-in</div>,
}));
vi.mock("@/components/omera-wordmark", () => ({
  OmeraWordmark: () => <span>Omera</span>,
}));
vi.mock("@/components/auth/redirect-if-signed-in", () => ({
  RedirectIfSignedIn: () => null,
}));
import LoginPage from "@/app/login/[[...sign-in]]/page";

afterEach(() => {
  cleanup();
});

describe("login page", () => {
  it("renders_clerk_sign_in", () => {
    render(<LoginPage />);
    expect(screen.getByTestId("clerk-sign-in")).toBeInTheDocument();
    expect(screen.getByText(/sign in or create an account/i)).toBeInTheDocument();
  });
});
