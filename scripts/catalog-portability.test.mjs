import { describe, expect, it, vi } from "vitest";

vi.mock("node:path", async (original) => {
  const path = await original();
  return { ...path, sep: "\\", relative: (...args) => path.relative(...args).replaceAll("/", "\\") };
});
const { loadCatalogEntries } = await import("./catalog-content.mjs");

describe("native Windows catalog hierarchy", () => {
  it("loads the exact taxonomy/vendor/tool hierarchy with native separators", async () => {
    const entries = await loadCatalogEntries();
    expect(entries.find(({ metadata }) => metadata.id === "intellij").metadata.company).toBe("JetBrains");
    expect(entries.every(({ metadata }) => metadata.releases.length > 0)).toBe(true);
  });
});
