import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { requireRequestOrigin } from "@/lib/auth/request-origin";

function request(origin?: string) {
  return new Request("https://omera.example/api/chat", {
    method: "POST", headers: origin ? { Origin: origin } : {},
  });
}

describe("request origins", () => {
  const env = { NODE_ENV: "test" as const, APP_ORIGIN: "https://omera.example" };

  it("accepts the exact approved origin", () => {
    expect(() => requireRequestOrigin(request("https://omera.example"), env)).not.toThrow();
  });

  it.each([undefined, "https://other.example", "null"])("rejects an unapproved origin: %s", (origin) => {
    expect(() => requireRequestOrigin(request(origin), env)).toThrow("ORIGIN_FORBIDDEN");
  });

  it("rejects missing configuration", () => {
    expect(() => requireRequestOrigin(request(), { NODE_ENV: "test" })).toThrow("SERVICE_UNAVAILABLE");
  });

  it("rejects production HTTP", () => {
    expect(() => requireRequestOrigin(request("http://127.0.0.1:3100"), {
      NODE_ENV: "production", APP_ORIGIN: "http://127.0.0.1:3100",
    })).toThrow("SERVICE_UNAVAILABLE");
  });

  it("permits explicit loopback HTTP during development", () => {
    expect(() => requireRequestOrigin(request("http://127.0.0.1:3100"), {
      NODE_ENV: "test", APP_ORIGIN: "http://127.0.0.1:3100",
    })).not.toThrow();
  });
});
