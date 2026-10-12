import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  use: {
    headless: true,
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL === "chromium" ? undefined : "chrome",
    trace: "off",
  },
  reporter: "list",
});
