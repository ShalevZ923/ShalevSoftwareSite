import { describe, expect, it } from "vitest";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { contentDirectory, generatedCatalogIsCurrent, loadCatalogEntries, renderGeneratedCatalog } from "./catalog-content.mjs";

describe("catalog checkout line endings", () => {
  it("renders identical catalog output from a CRLF guide checkout", async () => {
    const root = await mkdtemp(join(tmpdir(), "tool-atlas-crlf-"));
    try {
      const directory = join(root, "catalog");
      await cp(contentDirectory, directory, { recursive: true });
      const guidePath = join(directory, "development", "ides-and-editors", "jetbrains", "intellij", "guide.md");
      const guide = await readFile(guidePath, "utf8");
      await writeFile(guidePath, guide.replace(/\r?\n/g, "\r\n"));
      expect(renderGeneratedCatalog(await loadCatalogEntries(directory))).toBe(renderGeneratedCatalog(await loadCatalogEntries()));
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("accepts CRLF generated text but still rejects stale catalog content", async () => {
    const entries = await loadCatalogEntries();
    const generated = renderGeneratedCatalog(entries).replace(/\n/g, "\r\n");
    expect(generatedCatalogIsCurrent(generated, entries)).toBe(true);
    expect(generatedCatalogIsCurrent(generated.replace("IntelliJ IDEA", "Stale name"), entries)).toBe(false);
  });
});
