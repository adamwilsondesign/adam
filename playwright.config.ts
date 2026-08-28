import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3200";
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to reuse a preinstalled Chromium instead
 * of downloading browsers (e.g. /opt/pw-browsers/chromium in remote sandboxes).
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    launchOptions,
  },
  projects: [
    {
      name: "desktop-chromium",
      testIgnore: /mobile/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions,
      },
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile/,
      use: {
        ...devices["iPhone 14 Pro"],
        browserName: "chromium",
        launchOptions,
      },
    },
  ],
  webServer: {
    command: `npm run build:test && npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // The e2e suite is hermetic: it always runs on fixture content, even when
    // a developer's .env.local configures Sanity (blanking the project id
    // makes the facade treat Sanity as unconfigured).
    env: {
      NEXT_PUBLIC_CONTENT_SOURCE: "fixtures",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "",
      SANITY_API_READ_TOKEN: "",
      SANITY_API_WRITE_TOKEN: "",
    },
  },
});
