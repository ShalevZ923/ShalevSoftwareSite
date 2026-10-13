import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { createServerFixture } from "./test-fixtures/server-fixture.mjs";
import { createToolAtlasServer, developerToken } from "./server.mjs";
describe("disposable server data ownership", () => {
  it("confines recovery, catalog, documentation and guide operations to its fixture and preserves external canaries", async () => {
    const fixture = await createServerFixture();
    const protectedRoot = await mkdtemp(join(tmpdir(), "atlas-protected-canary-"));
    const protectedState = join(protectedRoot, "state"),
      protectedSource = join(protectedRoot, "private.txt");
    const protectedJournal = join(protectedState, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json");
    let server;
    const inside = (path) => {
      const rel = relative(fixture.root, path);
      return rel !== ".." && !rel.startsWith("..") && !isAbsolute(rel);
    };
    try {
      await mkdir(protectedState);
      await writeFile(protectedSource, "external canary");
      const canaryJournal = JSON.stringify({
        version: 1,
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        status: "prepared",
        changes: [{ path: protectedSource, previous: "original canary", next: "external canary" }],
      });
      await writeFile(protectedJournal, canaryJournal);
      const { catalogOutputs, ...directories } = fixture.options;
      for (const path of [...Object.values(directories), ...Object.values(catalogOutputs)])
        expect(inside(path)).toBe(true);
      // Successful startup recovery is confined to the fixture too.
      const fixtureDoc = join(fixture.options.documentationDirectory, "README.md");
      const originalDoc = await readFile(fixtureDoc, "utf8");
      await writeFile(fixtureDoc, "interrupted fixture edit");
      await writeFile(
        join(fixture.options.stateDirectory, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.json"),
        JSON.stringify({
          version: 1,
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          status: "prepared",
          changes: [{ path: fixtureDoc, previous: originalDoc, next: "interrupted fixture edit" }],
        }),
      );
      server = createToolAtlasServer(fixture.options);
      await new Promise((done, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", done);
      });
      const url = `http://127.0.0.1:${server.address().port}`;
      const headers = {
        Authorization: `Bearer ${developerToken}`,
        "Content-Type": "application/json",
      };
      const doc = await (await fetch(url + "/api/developer/docs/README.md", { headers })).json();
      expect(doc.content).toBe(originalDoc);
      const docSave = await fetch(url + "/api/developer/docs/README.md", {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...doc, content: "# Saved fixture document" }),
      });
      expect(docSave.status).toBe(200);
      const entry = await (await fetch(url + "/api/developer/tools/intellij", { headers })).json();
      entry.metadata.description = "Isolated catalog edit";
      const library = join(fixture.options.guideLibraryDirectory, "intellij");
      await mkdir(library);
      await writeFile(join(library, "fixture-only.pdf"), "fixture guide");
      entry.metadata.resources = [
        {
          id: "fixture-guide",
          title: "Fixture guide",
          kind: "internal-guide",
          format: "pdf",
          file: "intellij/fixture-only.pdf",
          appliesTo: ["all"],
          owner: "Test fixture",
          reviewedOn: "2026-10-13",
        },
      ];
      expect((await fetch(url + "/api/developer/guide-library/intellij", { headers })).status).toBe(
        200,
      );
      const files = await (
        await fetch(url + "/api/developer/guide-library/intellij", { headers })
      ).json();
      expect(files).toEqual(["intellij/fixture-only.pdf"]);
      const saved = await fetch(url + "/api/developer/tools/intellij", {
        method: "PUT",
        headers,
        body: JSON.stringify(entry),
      });
      expect(saved.status).toBe(200);
      expect((await fetch(url + "/api/catalog")).status).toBe(200);
      for (const name of await readdir(fixture.options.stateDirectory)) {
        const journal = JSON.parse(
          await readFile(join(fixture.options.stateDirectory, name), "utf8"),
        );
        for (const item of journal.changes) expect(inside(item.path)).toBe(true);
      }
      expect(await readFile(protectedSource, "utf8")).toBe("external canary");
      expect(await readFile(protectedJournal, "utf8")).toBe(canaryJournal);
      expect(await readdir(protectedState)).toEqual(["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json"]);
    } finally {
      if (server?.listening) await new Promise((done) => server.close(done));
      await fixture.cleanup();
      await rm(protectedRoot, { recursive: true, force: true });
    }
  });
});
