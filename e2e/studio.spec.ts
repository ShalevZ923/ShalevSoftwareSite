import { test, expect } from "@playwright/test";
import { rm } from "node:fs/promises";
import { createToolAtlasServer, developerToken } from "../scripts/server.mjs";
import { createServerFixture } from "../scripts/test-fixtures/server-fixture.mjs";
let server: ReturnType<typeof createToolAtlasServer>, root: string, url: string;
test.beforeAll(async () => {
  const fixture = await createServerFixture({ productionBuild: true });
  root = fixture.root;
  server = createToolAtlasServer(fixture.options);
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  url = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server?.listening) await new Promise<void>((done) => server.close(() => done()));
  if (root) await rm(root, { recursive: true, force: true });
});
test("Studio edits survive save and reload; stale drafts cannot overwrite them", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + "?page=developer#token=" + developerToken);
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();
  const first = page.getByLabel("Tool name", { exact: true });
  await first.fill("Maintained IntelliJ");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText(/Successfully saved Maintained IntelliJ/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Tool name", { exact: true })).toHaveValue("Maintained IntelliJ");
  await page.getByRole("button", { name: "Releases", exact: true }).click();
  const makeDefault = page.getByRole("button", { name: "Make default", exact: true });
  if (await makeDefault.count()) {
    await makeDefault.first().click();
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByText(/Successfully saved/)).toBeVisible();
  }
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(url + "?page=developer#token=" + developerToken);
  await expect(other.getByLabel("Tool name", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByLabel("Tool name", { exact: true }).fill("Newest IntelliJ");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText(/Successfully saved Newest/)).toBeVisible();
  await other.getByLabel("Tool name", { exact: true }).fill("Stale IntelliJ");
  await other.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(other.getByText(/changed since you loaded/)).toBeVisible();
  await expect(other.getByLabel("Tool name", { exact: true })).toHaveValue("Stale IntelliJ");
  await other.getByText("Compare retained draft with the saved record", { exact: true }).click();
  await other.getByRole("button", { name: "Load saved record for comparison" }).click();
  await expect(
    other.locator("details").filter({ hasText: "Compare retained draft" }),
  ).toContainText("Newest IntelliJ");
  other.on("dialog", (dialog) => dialog.accept());
  await other.getByRole("button", { name: "Reload list", exact: true }).click();
  await expect(other.getByLabel("Tool name", { exact: true })).toHaveValue("Newest IntelliJ");
  await context.close();
  expect(errors).toEqual([]);
});
test("catalog renders and navigates at desktop and mobile widths", async ({ page }) => {
  await page.goto(url + "?page=catalog");
  await expect(page.getByRole("heading", { name: "Software catalog" })).toBeVisible();
  await page.getByLabel("Search tools").fill("IntelliJ");
  await expect(page.locator(".tool-row").filter({ hasText: "IntelliJ" }).first()).toBeVisible();
  await page.screenshot({ path: "/tmp/atlas-172-desktop.png", fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.screenshot({ path: "/tmp/atlas-172-mobile.png", fullPage: false });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
});

test("nested documentation conflicts retain drafts and navigation guards prevent accidental loss", async ({
  page,
  browser,
}) => {
  await page.goto(url + "?page=developer#token=" + developerToken);
  await page.getByRole("button", { name: /System docs/ }).click();
  const editor = page.getByLabel("Document Markdown");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue(/^# Tool Atlas internal documentation/);
  await page.getByRole("button", { name: /development\/DEVELOPER_GUIDE\.md/ }).click();
  await expect(editor).toHaveValue(/^# Developer guide/);
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(url + "?page=developer#token=" + developerToken);
  await other.getByRole("button", { name: /System docs/ }).click();
  await expect(other.getByLabel("Document Markdown")).toBeVisible();
  await other.getByRole("button", { name: /development\/DEVELOPER_GUIDE\.md/ }).click();
  await expect(other.getByLabel("Document Markdown")).toHaveValue(/^# Developer guide/);
  await editor.fill("# Maintained documentation\n\nSaved browser evidence.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText(/Successfully saved docs/)).toBeVisible();
  await other.getByLabel("Document Markdown").fill("# Retained stale document");
  await other.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(other.getByText(/changed since you loaded/)).toBeVisible();
  await expect(other.getByLabel("Document Markdown")).toHaveValue("# Retained stale document");
  other.on("dialog", (dialog) => dialog.dismiss());
  await other.getByRole("button", { name: "Exit Studio", exact: true }).click();
  await expect(other.getByLabel("Document Markdown")).toHaveValue("# Retained stale document");
  await context.close();
});
test("validation moves focus to the precise guide control and preserves input", async ({
  page,
}) => {
  await page.goto(url + "?page=developer#token=" + developerToken);
  await page.getByRole("button", { name: "Guides", exact: true }).click();
  const guide = page.getByLabel("Guide Markdown");
  await guide.fill("# Draft without required sections");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(guide).toHaveValue("# Draft without required sections");
  await expect(guide).toBeFocused();
});
