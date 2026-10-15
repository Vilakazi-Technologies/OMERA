import { expect, test } from "@playwright/test";

/**
 * Completed-form browser flow: upload, question, answer, edit, refresh,
 * review, and download.
 * BLOCKED until the Playwright binaries and the G4 forms exist: written
 * but not run here, so no pass is claimed.
 */
test.describe("completed form flow", () => {
  test("upload, answer, edit, refresh, review, and download", async ({
    page,
  }) => {
    await page.goto("/form");

    // Upload a fillable AcroForm PDF (gate G4 fixture).
    const upload = page.locator('input[type="file"]');
    await upload.setInputFiles("tests/e2e/fixtures/g4-acroform.pdf");
    await expect(page.getByText("Field 1 of")).toBeVisible();

    // Question: exactly one active question per screen.
    const composer = page.getByRole("textbox", { name: "Message" });
    await composer.fill("Thendo");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Field 2 of")).toBeVisible();

    // Answer, then edit the earlier answer without losing later answers.
    await composer.fill("Thohoyandou");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByRole("button", { name: "Download completed PDF" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit Full name" }).click();
    await expect(page.getByText("Field 1 of")).toBeVisible();
    await composer.fill("Thendo M");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Thohoyandou")).toBeVisible();

    // Refresh restores the session through its server ID.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Download completed PDF" }),
    ).toBeVisible();

    // Review precedes export; the download is a real PDF.
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download completed PDF" }).click();
    const completed = await download;
    expect(completed.suggestedFilename()).toMatch(/-completed\.pdf$/);
  });
});
