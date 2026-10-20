import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { createToolAtlasServer, developerToken } from "./server.mjs";
import { createServerFixture } from "./test-fixtures/server-fixture.mjs";
const headers = { Authorization: `Bearer ${developerToken}`, "Content-Type": "application/json" };
let root, docs, server, url;
beforeEach(async () => {
  const fixture = await createServerFixture({ seedDocumentation: false });
  root = fixture.root;
  docs = join(root, "docs");
  await mkdir(join(docs, "development"), { recursive: true });
  await mkdir(join(docs, "deployment", "windows"), { recursive: true });
  await writeFile(join(docs, "README.md"), "# Master index");
  await writeFile(join(docs, "development", "README.md"), "# Developer notes");
  await writeFile(join(docs, "deployment", "windows", "README.md"), "# Windows notes");
  server = createToolAtlasServer(fixture.options);
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  url = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  if (server?.listening) await new Promise((done) => server.close(done));
  await rm(root, { recursive: true, force: true });
});
describe("nested internal documentation", () => {
  it("lists every depth with distinct relative names and the master index first", async () => {
    const response = await fetch(url + "/api/developer/docs", { headers });
    expect(response.status).toBe(200);
    const list = await response.json();
    expect(list.map((item) => item.name)).toEqual([
      "README.md",
      "deployment/windows/README.md",
      "development/README.md",
    ]);
    for (const file of list) {
      const response = await fetch(url + "/api/developer/docs/" + encodeURIComponent(file.name), {
        headers,
      });
      expect(response.status).toBe(200);
      expect((await response.json()).name).toBe(file.name);
    }
  });
  it("saves encoded nested paths and rejects stale writes without changing adjacent docs", async () => {
    const endpoint =
      url + "/api/developer/docs/" + encodeURIComponent("deployment/windows/README.md");
    const loaded = await (await fetch(endpoint, { headers })).json();
    const put = (content) =>
      fetch(endpoint, {
        method: "PUT",
        headers,
        body: JSON.stringify({ content, revision: loaded.revision }),
      });
    expect((await put("# Maintained Windows notes")).status).toBe(200);
    expect((await put("# Stale overwrite")).status).toBe(409);
    expect(await readFile(join(docs, "deployment/windows/README.md"), "utf8")).toBe(
      "# Maintained Windows notes",
    );
    expect(await readFile(join(docs, "development/README.md"), "utf8")).toBe("# Developer notes");
  });
  it("retains authentication and method restrictions for nested documentation", async () => {
    const endpoint = url + "/api/developer/docs/development/README.md";
    expect((await fetch(endpoint)).status).toBe(401);
    const invalid = await fetch(endpoint, { method: "DELETE", headers });
    expect(invalid.status).toBe(405);
    expect(invalid.headers.get("allow")).toBe("GET, PUT");
    for (const path of [
      "%2e%2e%2foutside.md",
      "development%2f..%2f..%2foutside.md",
      "development%5coutside.md",
      "development%252fREADME.md",
    ]) {
      expect((await fetch(url + "/api/developer/docs/" + path, { headers })).status).toBe(404);
    }
  });
  it.runIf(process.platform !== "win32")(
    "omits linked files/folders and prevents linked reads and writes",
    async () => {
      const outside = join(root, "outside.md");
      await writeFile(outside, "Private outside bytes");
      await symlink(outside, join(docs, "development", "LINK.md"));
      await symlink(root, join(docs, "external"));
      const list = await (await fetch(url + "/api/developer/docs", { headers })).json();
      expect(list.map((item) => item.name)).not.toContain("development/LINK.md");
      expect(list.some((item) => item.name.startsWith("external/"))).toBe(false);
      for (const path of ["development/LINK.md", "external/outside.md"]) {
        const endpoint = url + "/api/developer/docs/" + encodeURIComponent(path);
        expect((await fetch(endpoint, { headers })).status).toBe(404);
        expect(
          (
            await fetch(endpoint, {
              method: "PUT",
              headers,
              body: JSON.stringify({ content: "Overwrite", revision: "x" }),
            })
          ).status,
        ).toBe(404);
      }
      expect(await readFile(outside, "utf8")).toBe("Private outside bytes");
    },
  );
});
