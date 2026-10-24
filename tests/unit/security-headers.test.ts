import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("security headers", () => {
  it("sets the baseline headers on every path", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/(.*)");
    const headers = Object.fromEntries(
      rules[0].headers.map((header) => [header.key, header.value]),
    );
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(headers["Permissions-Policy"]).toContain("microphone=(self)");
    expect(headers["Content-Security-Policy-Report-Only"]).toContain(
      "frame-ancestors 'none'",
    );
  });
});
