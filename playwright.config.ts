import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/",
  reporter: [["list"], ["html", { outputFolder: "playwright-report/", open: "never" }]],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
    {
      name: "chromium-mobile",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
    {
      name: "firefox-desktop",
      use: { browserName: "firefox", viewport: { width: 1280, height: 800 } },
    },
    {
      name: "firefox-mobile",
      use: { browserName: "firefox", viewport: { width: 390, height: 844 } },
    },
    {
      name: "webkit-desktop",
      use: { browserName: "webkit", viewport: { width: 1280, height: 800 } },
    },
    {
      name: "webkit-mobile",
      use: { browserName: "webkit", viewport: { width: 390, height: 844 } },
    },
  ],
});
