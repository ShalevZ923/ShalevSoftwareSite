import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createToolAtlasServer, developerToken } from "./server.mjs";
import { createServerFixture } from "./test-fixtures/server-fixture.mjs";
import {
  loadCatalogEntries,
  renderGeneratedCatalog,
  renderMachineCatalog,
} from "./catalog-content.mjs";

const faults = vi.hoisted(() => ({ target: null, external: null, docEdit: null }));
vi.mock("node:fs/promises", async (original) => {
  const fs = await original();
  return {
    ...fs,
    open: async (...args) => {
      const handle = await fs.open(...args);
      if (faults.docEdit && String(args[0]).endsWith(".pending")) {
        const path = faults.docEdit;
        faults.docEdit = null;
        await fs.writeFile(path, "External document edit");
      }
      return handle;
    },
    cp: async (from, to, options) => {
      await fs.cp(from, to, options);
      if (faults.external) {
        const path = faults.external;
        faults.external = null;
        const value = JSON.parse(await fs.readFile(path, "utf8"));
        value.description = "External edit during staging";
        await fs.writeFile(path, JSON.stringify(value));
      }
    },
    rename: async (from, to) => {
      if (faults.target === to && from.endsWith(".pending")) {
        faults.target = null;
        throw new Error("Injected publish failure");
      }
      return fs.rename(from, to);
    },
  };
});

let root, directory, outputs, server, baseUrl;
const versions = (entry) => entry.metadata.releases.map(({ version }) => version);
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${developerToken}` };
async function get(id = "intellij") {
  const response = await fetch(`${baseUrl}/api/developer/tools/${id}`, { headers });
  expect(response.status).toBe(200);
  return response.json();
}
async function save(entry) {
  const response = await fetch(`${baseUrl}/api/developer/tools/${entry.metadata.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(entry),
  });
  if (response.ok) entry.revision = (await response.clone().json()).entry.revision;
  return response;
}
async function assertConsistent(id, expected) {
  expect(versions(await get(id))).toEqual(expected);
  const source = await loadCatalogEntries(directory);
  expect(versions(source.find(({ metadata }) => metadata.id === id))).toEqual(expected);
  expect(await readFile(outputs.generatedPath, "utf8")).toBe(renderGeneratedCatalog(source));
  const feed = await (await fetch(`${baseUrl}/api/catalog`)).json();
  expect(feed.tools.find((tool) => tool.id === id).releases.map(({ version }) => version)).toEqual(
    expected,
  );
  const machine = JSON.parse(await readFile(outputs.toolsPath, "utf8"));
  expect(
    machine.tools.find((tool) => tool.id === id).releases.map(({ version }) => version),
  ).toEqual(expected);
  const index = JSON.parse(await readFile(outputs.indexPath, "utf8"));
  expect(index.tools.find((tool) => tool.id === id).defaultVersion).toBe(expected[0]);
}

describe("isolated software release HTTP round trips", () => {
  beforeEach(async () => {
    const fixture = await createServerFixture({ seedDocumentation: false });
    root = fixture.root;
    directory = fixture.options.catalogDirectory;
    // Match the server's canonical source root, including Windows short-name expansion.
    directory = await realpath(directory);
    outputs = fixture.options.catalogOutputs;
    const entries = await loadCatalogEntries(directory);
    const feed = renderMachineCatalog(entries);
    await writeFile(outputs.generatedPath, renderGeneratedCatalog(entries));
    await writeFile(outputs.indexPath, feed.index);
    await writeFile(outputs.toolsPath, feed.tools);

    await writeFile(join(root, "docs", "TEST.md"), "Original document");
    server = createToolAtlasServer(fixture.options);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  afterEach(async () => {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("preserves docs on stale and external staging edits", async () => {
    const endpoint = baseUrl + "/api/developer/docs/TEST.md";
    const original = await (await fetch(endpoint, { headers })).json();
    const put = (body) => fetch(endpoint, { method: "PUT", headers, body: JSON.stringify(body) });
    const success = await put({ ...original, content: "Saved document" });
    expect(success.status).toBe(200);
    const stale = await put({ ...original, content: "Stale overwrite" });
    expect(stale.status).toBe(409);
    expect(await readFile(join(root, "docs", "TEST.md"), "utf8")).toBe("Saved document");
    const fresh = await (await fetch(endpoint, { headers })).json();
    faults.docEdit = join(root, "docs", "TEST.md");
    const external = await put({ ...fresh, content: "Overwrite external" });
    expect(external.status).toBe(409);
    expect(await readFile(join(root, "docs", "TEST.md"), "utf8")).toBe("External document edit");
  });
  it("returns validation errors for malformed bodies and nested policy failures", async () => {
    const current = await get();
    const bodies = [
      null,
      {
        metadata: { ...current.metadata, id: "invalid-category", category: "Unknown" },
        guide: current.guide,
      },
      { metadata: { ...current.metadata, resources: [null] }, guide: current.guide },
      { metadata: { ...current.metadata, releases: {} }, guide: current.guide },
    ];
    for (const body of bodies) {
      const response = await fetch(baseUrl + "/api/developer/tools", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
    }
  });

  it("rejects duplicate orders without damaging source or the public feed", async () => {
    const entry = await get();
    const before = structuredClone(entry);
    entry.metadata.order = (await get("docker")).metadata.order;
    expect((await save(entry)).status).toBe(400);
    expect(await get()).toEqual(before);
    expect((await fetch(`${baseUrl}/api/catalog`)).status).toBe(200);
  });
  it("retains external source edits made during staging", async () => {
    const entry = await get();
    entry.metadata.description = "Studio draft";
    faults.external = join(directory, "development/ides-and-editors/jetbrains/intellij/tool.json");
    const response = await save(entry);
    expect(response.status).toBe(409);
    expect((await get()).metadata.description).toBe("External edit during staging");
  });
  it("rejects stale revisions and retains the accepted edit", async () => {
    const first = await get();
    const stale = structuredClone(first);
    first.metadata.description = "Accepted change";
    expect((await save(first)).status).toBe(200);
    stale.metadata.description = "Stale change";
    const response = await save(stale);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("REVISION_CONFLICT");
    expect((await get()).metadata.description).toBe("Accepted change");
  });
  it("requires a revision on existing records", async () => {
    const entry = await get();
    delete entry.revision;
    expect((await save(entry)).status).toBe(428);
  });
  it("persists Make default in source, editor, generated output and feeds", async () => {
    const entry = await get();
    entry.metadata.releases.push({ version: "999", download: "https://example.com/999" });
    entry.metadata.releases.reverse();
    expect((await save(entry)).status).toBe(200);
    await assertConsistent("intellij", versions(entry));
  });

  it("reconciles removals and renames without touching package binaries", async () => {
    const entry = await get();
    entry.metadata.releases.push({ version: "999", download: "https://example.com/999" });
    expect((await save(entry)).status).toBe(200);
    const removed = entry.metadata.releases[0].version;
    entry.metadata.releases = [{ version: "998", download: "https://example.com/998" }];
    const binary = join(root, "packages", "intellij", removed, "installer.msi");
    await mkdir(join(root, "packages", "intellij", removed), { recursive: true });
    await writeFile(binary, "approved package");
    expect((await save(entry)).status).toBe(200);
    await assertConsistent("intellij", ["998"]);
    const files = await readdir(
      join(directory, "development", "ides-and-editors", "jetbrains", "intellij", "releases"),
    );
    expect(files).toEqual(["998.json"]);
    expect(await readFile(binary, "utf8")).toBe("approved package");
  });

  it.each([
    [],
    [
      { version: "1", download: "https://example.com/1" },
      { version: "1", download: "https://example.com/2" },
    ],
  ])(
    "rejects invalid release saves without changing source or generated bytes",
    async (releases) => {
      const before = await get();
      const generated = await readFile(outputs.generatedPath, "utf8");
      const changed = structuredClone(before);
      changed.metadata.releases = releases;
      expect((await save(changed)).status).toBe(400);
      expect(await get()).toEqual(before);
      expect(await readFile(outputs.generatedPath, "utf8")).toBe(generated);
    },
  );

  it.each(["generatedPath", "indexPath", "toolsPath"])(
    "leaves source and output unchanged when staging %s fails",
    async (key) => {
      const before = await get();
      const changed = structuredClone(before);
      changed.metadata.description = "must not persist";
      changed.metadata.releases = [{ version: "new", download: "https://example.com/new" }];
      const originals = await Promise.all(
        Object.values(outputs).map((path) => readFile(path, "utf8")),
      );
      await rm(outputs[key]);
      await mkdir(outputs[key]);
      expect((await save(changed)).status).toBe(500);
      expect(await get()).toEqual(before);
      for (const [index, [name, path]] of Object.entries(outputs).entries()) {
        if (name !== key) expect(await readFile(path, "utf8")).toBe(originals[index]);
      }
    },
  );

  it.each(["tool.json", "guide.md", "new.json", "catalog.ts", "index.json", "tools.json"])(
    "rolls back a publish failure at %s",
    async (filename) => {
      const before = await get();
      const changed = structuredClone(before);
      changed.metadata.description = "must roll back";
      changed.metadata.releases = [{ version: "new", download: "https://example.com/new" }];
      const originalEntries = await loadCatalogEntries(directory);
      const originalOutputs = await Promise.all(
        Object.values(outputs).map((path) => readFile(path, "utf8")),
      );
      const entryRoot = join(directory, "development", "ides-and-editors", "jetbrains", "intellij");
      faults.target =
        filename.endsWith(".ts") || ["index.json", "tools.json"].includes(filename)
          ? Object.values(outputs).find((path) => basename(path) === filename)
          : join(entryRoot, filename === "new.json" ? "releases/new.json" : filename);
      expect((await save(changed)).status).toBe(500);
      expect(await loadCatalogEntries(directory)).toEqual(originalEntries);
      expect(
        await Promise.all(Object.values(outputs).map((path) => readFile(path, "utf8"))),
      ).toEqual(originalOutputs);
      expect(await get()).toEqual(before);
      // A rejected mutation must not poison the serialization queue.
      expect((await save(before)).status).toBe(200);
    },
  );

  it("serializes concurrent edits and includes both in generated output", async () => {
    const first = await get("intellij");
    const second = await get("docker");
    first.metadata.description = "First concurrent edit";
    second.metadata.description = "Second concurrent edit";
    const results = await Promise.all([save(first), save(second)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect((await get("intellij")).metadata.description).toBe(first.metadata.description);
    expect((await get("docker")).metadata.description).toBe(second.metadata.description);
    await assertConsistent("intellij", versions(first));
    await assertConsistent("docker", versions(second));
  });

  it("allows retrying a new tool after a rolled-back publish", async () => {
    const entry = await get();
    entry.metadata.id = "retry-tool";
    delete entry.metadata.order;
    entry.metadata.releases = [{ version: "1", download: "https://example.com/1" }];
    const originalEntries = await loadCatalogEntries(directory);
    const originalOutputs = await Promise.all(
      Object.values(outputs).map((path) => readFile(path, "utf8")),
    );
    const create = () =>
      fetch(`${baseUrl}/api/developer/tools`, {
        method: "POST",
        headers,
        body: JSON.stringify(entry),
      });
    faults.target = outputs.toolsPath;
    expect((await create()).status).toBe(500);
    expect(await loadCatalogEntries(directory)).toEqual(originalEntries);
    expect(await Promise.all(Object.values(outputs).map((path) => readFile(path, "utf8")))).toEqual(
      originalOutputs,
    );
    expect((await create()).status).toBe(201);
    await assertConsistent("retry-tool", ["1"]);
    expect((await create()).status).toBe(409);
  });

  it("rejects missing or ambiguous persisted defaults", async () => {
    const path = join(
      directory,
      "development",
      "ides-and-editors",
      "jetbrains",
      "intellij",
      "tool.json",
    );
    const tool = JSON.parse(await readFile(path, "utf8"));
    for (const releaseOrder of [[], ["missing"], ["2025.1", "2025.1"]]) {
      await writeFile(path, JSON.stringify({ ...tool, releaseOrder }));
      await expect(loadCatalogEntries(directory)).rejects.toThrow(
        "releaseOrder must list every release version exactly once",
      );
    }
  });
});
