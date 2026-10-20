import { describe, expect, it, vi } from "vitest";
vi.mock("node:path", async (original) => {
  const path = await original();
  return { ...path, sep: "\\", relative: (...args) => path.relative(...args).replaceAll("/", "\\") };
});
const { loadAgentEntries } = await import("./agents-content.mjs");
describe("native Windows agent hierarchy", () => {
  it("loads taxonomy and canonical portable guide paths", async () => {
    const entries = await loadAgentEntries();
    expect(entries.some((entry) => entry.metadata.id === "anthropic-pdf")).toBe(true);
    expect(entries.every((entry) => entry.guidePath.startsWith("/content/agents/") && !entry.guidePath.includes("\\"))).toBe(true);
  });
});
