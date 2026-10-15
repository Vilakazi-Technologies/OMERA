import { expect, test } from "@playwright/test";

const STREAM_BODY =
  'data: {"token":"Start with one paying customer."}\n\ndata: [DONE]\n\n';

/**
 * Chat browser flow. BLOCKED until the Playwright binaries exist (gate
 * ENV-1): written but not run here, so no pass is claimed.
 */
test("chat completes a business request without vendor text or stuck controls", async ({
  page,
}) => {
  await page.route("/api/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ userId: "e2e-user" }),
    }),
  );
  await page.route("/api/conversations", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversation: {
            id: "e2e-conversation",
            title: "New chat",
            mode: "chat",
            messages: [],
            updatedAt: Date.now(),
          },
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ conversations: [] }),
    });
  });
  await page.route("/api/chat", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: STREAM_BODY,
    }),
  );

  await page.goto("/chat");
  await expect(
    page.getByRole("heading", { name: "What does your business need next?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Help me obtain my first paying customer." })
    .click();
  await expect(
    page.getByText("Start with one paying customer."),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toBeEnabled();

  const copy = await page.content();
  for (const vendor of [
    "OpenAI",
    "ChatGPT",
    "GPT-4",
    "gpt-4o",
    "Metropolitan",
  ]) {
    expect(copy).not.toContain(vendor);
  }
});
