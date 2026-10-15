import { expect, test } from "@playwright/test";

/**
 * Native voice browser flow: consent, stop, review, edit, submit.
 * BLOCKED until the Playwright binaries exist: written but not run
 * here, so no pass is claimed.
 */
test.describe("native voice input", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["microphone"]);
  });

  test("consent, stop, review, edit, and submit a native transcript", async ({
    page,
  }) => {
    await page.route("/api/transcribe", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ text: "Sawubona", languageId: "zul" }),
      }),
    );
    await page.goto("/chat");

    // Consent: recording starts after microphone permission is granted.
    await page.getByRole("button", { name: "Record voice" }).click();
    await expect(
      page.getByRole("button", { name: "Stop recording" }),
    ).toBeVisible();

    // Stop: the transcript returns for review, editable, unsent.
    await page.getByRole("button", { name: "Stop recording" }).click();
    const box = page.getByRole("textbox", { name: "Message" });
    await expect(box).toHaveValue("Sawubona");

    // Edit then submit sends the edited native text.
    await box.fill("Sawubona mngani");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(box).toHaveValue("");
  });

  test("a failed transcription stays visible and submits nothing", async ({
    page,
  }) => {
    await page.route("/api/transcribe", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "VOICE_UNAVAILABLE" }),
      }),
    );
    await page.goto("/chat");

    await page.getByRole("button", { name: "Record voice" }).click();
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByRole("alert")).toContainText(
      /transcription failed/i,
    );
  });
});
