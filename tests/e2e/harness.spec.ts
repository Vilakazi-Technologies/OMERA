import { expect, test } from "@playwright/test";

test("shows the Omera title on the login page", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/Omera/);
});
