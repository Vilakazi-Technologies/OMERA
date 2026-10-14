import { describe, expect, it } from "vitest";
import { validateIntegrationTarget } from "../integration/target";

const productionUrl = "https://production.supabase.co";
const testUrl = "https://integration.supabase.co";

describe("validateIntegrationTarget", () => {
  it.each([
    ["HTTPS normalization", "HTTPS://INTEGRATION.SUPABASE.CO", `${testUrl}/`],
    ["a trailing slash", `${testUrl}/`, `${testUrl}/`],
    ["localhost", "http://localhost:54321", "http://localhost:54321/"],
    ["IPv4 loopback", "http://127.0.0.1:54321", "http://127.0.0.1:54321/"],
    ["IPv6 loopback", "http://[::1]:54321", "http://[::1]:54321/"],
  ])("accepts %s", (_name, target, normalized) => {
    expect(validateIntegrationTarget(productionUrl, target)).toBe(normalized);
  });

  it("accepts loopback aliases with different ports", () => {
    expect(
      validateIntegrationTarget("http://localhost:54321", "http://[::1]:54322"),
    ).toBe("http://[::1]:54322/");
  });

  it.each([
    [undefined, testUrl],
    ["", testUrl],
    [productionUrl, undefined],
    [productionUrl, ""],
  ])("rejects missing inputs (%s, %s)", (production, target) => {
    expect(() => validateIntegrationTarget(production, target)).toThrow(
      /^ISOLATED_DATABASE_REQUIRED$/,
    );
  });

  it.each([
    "https://PRODUCTION.SUPABASE.CO/",
    "https://production.supabase.co:8443/",
    "http://production.supabase.co/",
  ])("rejects the same remote hostname: %s", (target) => {
    expect(() => validateIntegrationTarget(productionUrl, target)).toThrow(
      /^ISOLATED_DATABASE_REQUIRED$/,
    );
  });

  for (const production of ["localhost", "127.0.0.1", "[::1]"]) {
    it.each(["localhost", "127.0.0.1", "[::1]"])(
      `rejects ${production} through loopback alias %s on the same port`,
      (target) => {
        expect(() =>
          validateIntegrationTarget(
            `http://${production}:54321`,
            `http://${target}:54321`,
          ),
        ).toThrow(/^ISOLATED_DATABASE_REQUIRED$/);
      },
    );
  }

  it("rejects loopback aliases on the default HTTP port", () => {
    expect(() =>
      validateIntegrationTarget("http://localhost", "http://[::1]:80"),
    ).toThrow(/^ISOLATED_DATABASE_REQUIRED$/);
  });

  const invalidUrls = [
    "not a URL",
    "/relative",
    "https://",
    "http://integration.supabase.co",
    "https://example.com",
    "https://supabase.co",
    "https://integration.supabase.co.example.com",
    "https://evil-supabase.co",
    "http://192.168.1.1:54321",
    "https://localhost:54321",
    "ftp://integration.supabase.co",
    "https://username@integration.supabase.co",
    "https://:secret@integration.supabase.co",
    "https://username:secret@integration.supabase.co",
    "https://integration.supabase.co?key=secret",
    "https://integration.supabase.co?",
    "https://integration.supabase.co#secret",
    "https://integration.supabase.co#",
    "https://integration.supabase.co/rest/v1",
    "http://localhost:54321/rest/v1",
    "http://username:secret@localhost:54321",
    "http://[::1]:54321?key=secret",
    "http://127.0.0.1:54321#secret",
  ];

  it.each(invalidUrls)("rejects an invalid test URL: %s", (target) => {
    expect(() => validateIntegrationTarget(productionUrl, target)).toThrow(
      /^ISOLATED_DATABASE_REQUIRED$/,
    );
  });

  it.each(invalidUrls)("rejects an invalid production URL: %s", (production) => {
    expect(() =>
      validateIntegrationTarget(production, "https://separate.supabase.co"),
    ).toThrow(/^ISOLATED_DATABASE_REQUIRED$/);
  });

  it("accepts distinct HTTPS Supabase projects", () => {
    expect(
      validateIntegrationTarget(
        "https://production.supabase.co",
        "https://integration.supabase.co",
      ),
    ).toBe("https://integration.supabase.co/");
  });

  it("rejects the same loopback target through an alias", () => {
    expect(() =>
      validateIntegrationTarget(
        "http://localhost:54321",
        "http://127.0.0.1:54321",
      ),
    ).toThrow(/^ISOLATED_DATABASE_REQUIRED$/);
  });
});
