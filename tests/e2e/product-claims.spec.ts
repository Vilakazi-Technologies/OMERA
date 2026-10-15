import { expect, test } from "@playwright/test";

/**
 * Product-claim browser checks: rendered copy matches the capability
 * response and the measured support matrix.
 * BLOCKED until the Playwright binaries exist: written but not run
 * here, so no pass is claimed.
 */
test.describe("product claims match measured support", () => {
  test("the language section matches the capability matrix", async ({
    page,
  }) => {
    const capabilities = await page
      .request.get("/api/capabilities")
      .then((response) => response.json() as Promise<{
        languages: Array<{ id: string; speech: string }>;
      }>);
    expect(capabilities.languages).toHaveLength(11);

    await page.goto("/");
    await expect(page.getByText("11 spoken languages").first()).toBeVisible();

    const supported = capabilities.languages.filter(
      (row) => row.speech === "supported",
    );
    const beta = capabilities.languages.filter(
      (row) => row.speech === "beta",
    );
    expect(supported.map((row) => row.id).sort()).toEqual(["eng", "zul"]);
    expect(beta.map((row) => row.id).sort()).toEqual(["afr", "sot"]);

    // No measured-quality claim may appear before evaluation recordings exist.
    const copy = await page.content();
    expect(copy).not.toMatch(/measured\s+\d+%/i);
  });

  test("form copy promises only fillable PDFs", async ({ page }) => {
    await page.goto("/");
    const copy = await page.content();
    expect(copy).toMatch(/fillable PDF/i);
    expect(copy).not.toMatch(/enterprise-ready/i);
    expect(copy).not.toMatch(/POPIA-conscious/i);
  });
});
