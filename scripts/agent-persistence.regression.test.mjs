import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
const faults = vi.hoisted(() => ({ target: "" }));
vi.mock("node:fs/promises", async (original) => {
  const fs = await original();
  return { ...fs, rename: async (from, to) => {
    if (faults.target && to.endsWith(faults.target)) {
      faults.target = "";
      throw new Error("Injected publication failure");
    }
    return fs.rename(from, to);
  } };
});
import { createServerFixture } from "./test-fixtures/server-fixture.mjs";
import { loadAgentEntries, packageTypes, renderGeneratedAgents } from "./agents-content.mjs";
import { saveAgentStudioEntry } from "./agent-studio.mjs";
import { recordRevision, sourceSnapshot } from "./mutation-coordinator.mjs";
let fixture;
afterEach(async () => { faults.target = ""; await fixture?.cleanup(); });
async function setup() {
  fixture = await createServerFixture();
  const directory = fixture.options.agentContentDirectory;
  const generatedPath = fixture.options.agentGeneratedFile;
  const entries = await loadAgentEntries(directory);
  await writeFile(generatedPath, renderGeneratedAgents(entries));
  return { directory, generatedPath, stateDirectory: fixture.options.stateDirectory, entries };
}
describe("isolated transactional Agent Studio", () => {
  it.each([...packageTypes])("creates the first entry under initially absent %s", async (type, label) => {
    const options = await setup();
    const seed = options.entries.find((entry) => entry.metadata.packageType === label) || options.entries[0];
    await rm(join(options.directory, type), { recursive: true, force: true });
    const metadata = { ...seed.metadata, id: "first-fixture", publisher: "Fixture Publisher", packageType: label, status: "example", review: { status: "pending" }, releases: [], currentVersion: undefined, contents: [] };
    const saved = await saveAgentStudioEntry({ ...options, metadata, guide: seed.guide });
    expect(saved.metadata.id).toBe(metadata.id);
    expect((await loadAgentEntries(options.directory)).some((entry) => entry.metadata.id === metadata.id)).toBe(true);
    expect(await readFile(options.generatedPath, "utf8")).toContain(metadata.id);
  });
  it.each(["publisher.json", "agent.json", "guide.md", "1.0.0.json", "agents.ts"])("rolls back a failure publishing %s", async (target) => {
    const options = await setup();
    const seed = options.entries.find((entry) => entry.metadata.id === "anthropic-pdf");
    const before = await sourceSnapshot(options.directory);
    const generated = await readFile(options.generatedPath, "utf8");
    faults.target = target;
    await expect(saveAgentStudioEntry({ ...options, metadata: { ...seed.metadata, id: "fault-fixture", publisher: "Fixture Publisher", releases: [{ version: "1.0.0", releasedAt: "2026-10-01" }], currentVersion: "1.0.0" }, guide: seed.guide })).rejects.toThrow("Injected");
    expect(await sourceSnapshot(options.directory)).toBe(before);
    expect(await readFile(options.generatedPath, "utf8")).toBe(generated);
  });
  it("serializes separate records and rejects stale conflicting edits", async () => {
    const options = await setup();
    const [a, b] = options.entries;
    await Promise.all([a, b].map((entry) => saveAgentStudioEntry({ ...options, existingId: entry.metadata.id, revision: recordRevision(entry), metadata: { ...entry.metadata, description: "Serialized " + entry.metadata.id }, guide: entry.guide })));
    const generated = await readFile(options.generatedPath, "utf8");
    for (const entry of [a, b]) expect(generated).toContain("Serialized " + entry.metadata.id);
    await expect(saveAgentStudioEntry({ ...options, existingId: a.metadata.id, revision: recordRevision(a), metadata: a.metadata, guide: a.guide })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });
  it.runIf(process.platform !== "win32")("rejects a linked type without changing external bytes", async () => {
    const options = await setup();
    const outside = join(fixture.root, "outside");
    await writeFile(outside, "protected");
    await symlink(fixture.root, join(options.directory, "role-packs"));
    const seed = options.entries[0];
    await expect(saveAgentStudioEntry({ ...options, metadata: { ...seed.metadata, id: "escape", packageType: "Role Pack" }, guide: seed.guide })).rejects.toThrow(/symbolic/);
    expect(await readFile(outside, "utf8")).toBe("protected");
  });
});
