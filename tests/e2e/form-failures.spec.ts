import { expect, test } from "@playwright/test";

/**
 * Completed-form failure flow: a save failure prevents advancement and an
 * export failure keeps the session in review.
 * BLOCKED until the Playwright binaries and the G4 forms exist: written
 * but not run here, so no pass is claimed.
 */
test.describe("completed form failures", () => {
  test("a save failure prevents advancement", async ({ page }) => {
    await page.route("/api/forms/sessions/**", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "REVISION_CONFLICT" }),
      }),
    );
    await page.goto("/form");

    const upload = page.locator('input[type="file"]');
    await upload.setInputFiles("tests/e2e/fixtures/g4-acroform.pdf");
    await expect(page.getByText("Field 1 of")).toBeVisible();

    const composer = page.getByRole("textbox", { name: "Message" });
    await composer.fill("Thendo");
    await page.getByRole("button", { name: "Send message" }).click();

    // The failure is visible and the flow does not advance.
    await expect(page.getByRole("alert")).toContainText(/save failed/i);
    await expect(page.getByText("Field 1 of")).toBeVisible();
  });

  test("an export failure keeps the session in review", async ({ page }) => {
    await page.route("**/export", (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: "REQUIRED_FIELD" }),
      }),
    );
    await page.goto("/form");

    const upload = page.locator('input[type="file"]');
    await upload.setInputFiles("tests/e2e/fixtures/g4-acroform.pdf");
    await expect(
      page.getByRole("button", { name: "Download completed PDF" }),
    ).toBeVisible({ timeout: 30000 });

    await page.getByRole("button", { name: "Download completed PDF" }).click();
    await expect(page.getByRole("alert")).toContainText(/export failed/i);
    // Still in review: the download button is still available for retry.
    await expect(
      page.getByRole("button", { name: "Download completed PDF" }),
    ).toBeVisible();
  });
});
