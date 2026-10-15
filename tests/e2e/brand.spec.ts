import { expect, test } from "@playwright/test";

/**
 * Brand-safety browser checks: user-facing surfaces never expose
 * provider names or credentials, even on failure paths.
 * BLOCKED until the Playwright binaries exist: written but not run
 * here, so no pass is claimed.
 */
const INTERNAL_NAMES = [
  "OpenAI",
  "ChatGPT",
  "gpt-4o",
  "Xavani",
  "Lelapa",
  "Vulavula",
  "Whisper",
  "Supabase",
  "SERVICE_ROLE",
  "API_KEY",
];

test.describe("brand safety", () => {
  test("the landing page names no internal providers", async ({ page }) => {
    await page.goto("/");
    const copy = await page.content();
    for (const name of INTERNAL_NAMES) {
      expect(copy).not.toContain(name);
    }
    await expect(page.getByText("Omera").first()).toBeVisible();
    await expect(page.getByText("VILATECH").first()).toBeVisible();
  });

  test("a failed chat round trip leaks no provider detail", async ({
    page,
  }) => {
    await page.route("/api/chat", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "SERVICE_UNAVAILABLE" }),
      }),
    );
    await page.goto("/chat");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("Smoke check");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15000 });

    const copy = await page.content();
    for (const name of INTERNAL_NAMES) {
      expect(copy).not.toContain(name);
    }
  });

  test("a failed transcription leaks no provider detail", async ({
    page,
  }) => {
    await page.context().grantPermissions(["microphone"]);
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

    const copy = await page.content();
    for (const name of INTERNAL_NAMES) {
      expect(copy).not.toContain(name);
    }
  });
});
