import { test, expect } from "@playwright/test";
import { createToolAtlasServer, developerToken } from "../scripts/server.mjs";
import { createServerFixture } from "../scripts/test-fixtures/server-fixture.mjs";
let fixture: Awaited<ReturnType<typeof createServerFixture>>;
let server: ReturnType<typeof createToolAtlasServer>;
let url: string;
const headers = { Authorization: `Bearer ${developerToken}`, "Content-Type": "application/json" };
const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  fixture = await createServerFixture({ productionBuild: true });
  server = createToolAtlasServer(fixture.options);
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  url = `http://127.0.0.1:${server.address().port}`;
});
test.afterEach(async ({ page }) => {
  await page.close({ runBeforeUnload: false });
  if (server?.listening)
    await new Promise<void>((done) => {
      server.close(() => done());
      server.closeAllConnections();
    });
  await fixture?.cleanup();
  expect(errors).toEqual([]);
});

test("a delayed live-only deep link opens newly saved and edited guides without rebuilding", async ({
  page,
  request,
}, info) => {
  const entries = await (await request.get(url + "/api/developer/agents", { headers })).json();
  const seed = entries.find((entry: { id: string }) => entry.id === "anthropic-pdf");
  const created = await request.post(url + "/api/developer/agents", {
    headers,
    data: {
      metadata: {
        ...seed.metadata,
        id: "browser-role",
        name: "Browser Role",
        packageType: "Role Pack",
      },
      guide: seed.guide + "\n\nNew live guide evidence.",
    },
  });
  expect(created.status()).toBe(201);
  const accepted = await created.json();
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route("**/api/agents", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(url + "?page=agents&agent=browser-role");
  await expect(page.getByRole("heading", { name: "Agent Catalog", exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Tool Atlas — Agent Catalog");
  await expect(page).toHaveURL(/agent=browser-role/);
  await expect(page.getByText("This resource is no longer listed.", { exact: false })).toHaveCount(
    0,
  );
  release();
  const row = page.locator("#agent-browser-role");
  await expect(row.locator(".agent-row-summary")).toHaveAttribute("aria-expanded", "true");
  await row.getByText("Read usage guide", { exact: true }).click();
  await expect(row.locator(".agent-guide")).toContainText("New live guide evidence.");
  const edited = await request.put(url + "/api/developer/agents/browser-role", {
    headers,
    data: {
      metadata: accepted.agent,
      revision: accepted.revision,
      guide: seed.guide + "\n\nEdited live guide evidence.",
    },
  });
  expect(edited.status()).toBe(200);
  await page.reload();
  await row.getByText("Read usage guide", { exact: true }).click();
  await expect(row.locator(".agent-guide")).toContainText("Edited live guide evidence.");
  await page.screenshot({ path: info.outputPath("live-guide.png") });
});

test("filter edits survive delayed metadata and a genuinely missing target gets a notice", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route("**/api/agents", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(url + "?page=agents&agent=missing-agent");
  await page.getByLabel("Search Agent Catalog").fill("PDF");
  release();
  await expect(page.getByLabel("Search Agent Catalog")).toHaveValue("PDF");
  await expect(page).not.toHaveURL(/agent=/);
  await page.goto(url + "?page=agents&agent=missing-agent");
  await expect(page.getByText(/This resource is no longer listed/)).toBeVisible();
});

test("unknown versions are reconciled after loading", async ({ page }) => {
  await page.goto(url + "?page=agents&agent=internal-comms&version=missing-version");
  await expect(page.getByText(/The linked version is unavailable/)).toBeVisible();
  await expect(page.locator("#agent-internal-comms .agent-row-summary")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page).not.toHaveURL(/missing-version/);
});

test("static guides remain backend-free and live guide failures stay visible", async ({ page }) => {
  let liveGuideRequests = 0;
  await page.route("**/api/agents", (route) => route.abort());
  await page.route("**/api/agents/*/guide", (route) => {
    liveGuideRequests++;
    return route.fulfill({ status: 503, json: { error: "Unavailable" } });
  });
  await page.goto(url + "?page=agents&agent=anthropic-pdf");
  const row = page.locator("#agent-anthropic-pdf");
  await row.getByText("Read usage guide", { exact: true }).click();
  await expect(row.locator(".agent-guide")).toContainText("Overview");
  expect(liveGuideRequests).toBe(0);
  await page.unroute("**/api/agents");
  await page.reload();
  await row.getByText("Read usage guide", { exact: true }).click();
  await expect(row.locator(".agent-guide")).toHaveText("Guide unavailable.");
  expect(liveGuideRequests).toBeGreaterThan(0);
});

for (const reject of [false, true]) {
  test(`Studio locks selection during ${reject ? "rejected" : "successful"} saves and list edits are dirty before blur`, async ({
    page,
  }) => {
    await page.goto(url + "?page=developer#token=" + developerToken);
    await page.locator(".dev-tab-btn").getByText("Agent Catalog", { exact: true }).click();
    await expect(page.getByLabel("Resource ID", { exact: true })).toHaveValue("anthropic-pdf");
    const highlights = page.getByLabel("Highlights · one per line", { exact: true });
    await highlights.fill("First edited line\n\nSecond edited line");
    await expect(highlights).toBeFocused();
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ).toBe(true);
    let release!: () => void;
    let arrived!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const intercepted = new Promise<void>((done) => {
      arrived = done;
    });
    await page.route("**/api/developer/agents/anthropic-pdf", async (route) => {
      arrived();
      await gate;
      if (reject) await route.fulfill({ status: 400, json: { error: "Deferred save rejected" } });
      else await route.continue();
    });
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await intercepted;
    const other = page.locator(".dev-item-card").filter({ hasText: "Atlas Repo MCP" });
    await expect(other).toBeDisabled();
    await other.evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.getByLabel("Resource ID", { exact: true })).toHaveValue("anthropic-pdf");
    release();
    await expect(
      page.getByText(
        reject ? "Deferred save rejected" : /PDF Skill saved to the local Agent Catalog/,
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Resource ID", { exact: true })).toHaveValue("anthropic-pdf");
    await expect(other).toBeEnabled();
    if (!reject) {
      await expect(highlights).toHaveValue("First edited line\nSecond edited line");
      await other.click();
      await expect(page.getByLabel("Resource ID", { exact: true })).toHaveValue("atlas-repo-mcp");
    } else await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  });
}

test("Updates counts agent-only results and enforces every kind filter on mobile", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url + "?page=updates");
  await page.getByLabel("Search updates").fill("Time MCP Server");
  await expect(page.locator(".updates-count")).toContainText("1 change");
  await expect(page.getByText("No matching updates", { exact: true })).toHaveCount(0);
  for (const kind of ["New", "Releases", "Notices"]) {
    await page.getByRole("button", { name: kind, exact: true }).click();
    await expect(page.locator(".updates-count")).toContainText("0 changes");
    await expect(page.getByRole("heading", { name: "No matching updates" })).toBeVisible();
  }
  for (const kind of ["Other", "All"]) {
    await page.getByRole("button", { name: kind, exact: true }).click();
    await expect(page.locator(".updates-count")).toContainText("1 change");
    await expect(page.getByRole("heading", { name: /Time MCP Server/ })).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath("mobile-updates.png") });
});

test("Studio locks reviewed provenance for a downloadable agent", async ({ page }) => {
  await page.goto(url + "?page=developer#token=" + developerToken);
  await page.locator(".dev-tab-btn").getByText("Agent Catalog", { exact: true }).click();
  await page.locator(".dev-item-card").filter({ hasText: "Theme Factory" }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  for (const label of [
    "Source URL",
    "Pinned revision",
    "License",
    "Reviewed version",
    "Review date",
    "Review evidence",
  ]) {
    await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
  }
  await expect(page.getByRole("combobox", { name: "Review status", exact: true })).toBeDisabled();
});

test("saved live-only agents survive delayed and unavailable feeds", async ({ page, request }) => {
  const entries = await (await request.get(url + "/api/developer/agents", { headers })).json();
  const seed = entries.find((entry: { id: string }) => entry.id === "anthropic-pdf");
  const created = await request.post(url + "/api/developer/agents", {
    headers,
    data: {
      metadata: {
        ...seed.metadata,
        id: "saved-live-role",
        name: "Saved Live Role",
        packageType: "Role Pack",
      },
      guide: seed.guide,
    },
  });
  expect(created.status()).toBe(201);
  await page.addInitScript(() => {
    localStorage.setItem(
      "tool-atlas.saved-agents.v1",
      JSON.stringify(["saved-live-role", "removed-agent"]),
    );
  });
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route("**/api/agents", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(url + "?page=agents");
  await expect(page.getByRole("heading", { name: "Agent Catalog" })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("tool-atlas.saved-agents.v1")!)),
  ).toEqual(["saved-live-role", "removed-agent"]);
  release();
  await expect(page.getByRole("button", { name: "Saved (1)" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("tool-atlas.saved-agents.v1")!)),
    )
    .toEqual(["saved-live-role"]);
  await page.getByRole("button", { name: "Saved (1)" }).click();
  await expect(page.locator("#agent-saved-live-role")).toBeVisible();
});

test("an unavailable live feed does not erase saved live-only agents", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("tool-atlas.saved-agents.v1", JSON.stringify(["saved-live-only"])),
  );
  await page.route("**/api/agents", (route) => route.abort());
  await page.goto(url + "?page=agents");
  await expect(page.getByRole("heading", { name: "Agent Catalog" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Saved (0)" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("tool-atlas.saved-agents.v1")))
    .toBe(JSON.stringify(["saved-live-only"]));
});
