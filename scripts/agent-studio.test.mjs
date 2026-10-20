import { describe, expect, it } from "vitest";
import { cp, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { agentsDirectory, loadAgentEntries } from "./agents-content.mjs";
import { saveAgentStudioEntry } from "./agent-studio.mjs";
import { createToolAtlasServer, developerToken } from "./server.mjs";

describe("Agent Studio authoring", () => {
  it("saves validated listing text and button labels without weakening support gates", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-studio-"));
    const directory = join(root, "agents");
    const publisher = join(directory, "skills", "anthropic");
    try {
      await mkdir(publisher, { recursive: true });
      await cp(join(agentsDirectory, "skills", "anthropic", "publisher.json"), join(publisher, "publisher.json"));
      await cp(join(agentsDirectory, "skills", "anthropic", "anthropic-pdf"), join(publisher, "anthropic-pdf"), { recursive: true });
      const [entry] = await loadAgentEntries(directory);
      const metadata = { ...entry.metadata, description: "Updated from Studio.", downloadButtonLabel: "Get reviewed ZIP" };
      await saveAgentStudioEntry({ directory, generatedPath: join(root, "agents.ts"), existingId: metadata.id, metadata, guide: entry.guide });
      const [saved] = await loadAgentEntries(directory);
      expect(saved.metadata.description).toBe("Updated from Studio.");
      expect(saved.metadata.downloadButtonLabel).toBe("Get reviewed ZIP");
      expect(await readFile(join(root, "agents.ts"), "utf8")).toContain("Get reviewed ZIP");
      await expect(saveAgentStudioEntry({ directory, generatedPath: join(root, "agents.ts"), existingId: metadata.id,
        metadata: { ...metadata, status: "supported" }, guide: entry.guide })).rejects.toThrow("supported entries require");
      expect((await loadAgentEntries(directory))[0].metadata.status).toBe("example");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("protects Studio writes and refreshes the public agent feed after a validated save", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-studio-api-"));
    const directory = join(root, "agents");
    const publisher = join(directory, "skills", "anthropic");
    const dist = join(root, "dist");
    const packages = join(root, "packages");
    let server;
    try {
      await mkdir(publisher, { recursive: true });
      await mkdir(dist);
      await mkdir(packages);
      await cp(join(agentsDirectory, "skills", "anthropic", "publisher.json"), join(publisher, "publisher.json"));
      await cp(join(agentsDirectory, "skills", "anthropic", "anthropic-pdf"), join(publisher, "anthropic-pdf"), { recursive: true });
      server = createToolAtlasServer({ distDirectory: dist, packagesDirectory: packages,
        agentContentDirectory: directory, agentGeneratedFile: join(root, "agents.ts") });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const url = `http://127.0.0.1:${server.address().port}`;
      expect((await fetch(`${url}/api/developer/agents`)).status).toBe(401);
      const headers = { Authorization: `Bearer ${developerToken}`, "Content-Type": "application/json" };
      const entries = await (await fetch(`${url}/api/developer/agents`, { headers })).json();
      const update = { metadata: { ...entries[0].metadata, downloadButtonLabel: "Get reviewed ZIP" }, guide: entries[0].guide };
      const saved = await fetch(`${url}/api/developer/agents/anthropic-pdf`, { method: "PUT", headers, body: JSON.stringify(update) });
      expect(saved.status).toBe(200);
      const publicAgents = await (await fetch(`${url}/api/agents`)).json();
      expect(publicAgents[0].downloadButtonLabel).toBe("Get reviewed ZIP");
      const created = await fetch(`${url}/api/developer/agents`, { method: "POST", headers,
        body: JSON.stringify({ metadata: {
          ...entries[0].metadata, id: "studio-new-skill", name: "Studio New Skill", status: "example",
          review: { status: "pending" }, downloadButtonLabel: undefined, contents: [], tags: ["Studio"],
        }, guide: entries[0].guide }) });
      expect(created.status).toBe(201);
      expect((await (await fetch(`${url}/api/agents`)).json()).map((agent) => agent.id)).toContain("studio-new-skill");
      const rejected = await fetch(`${url}/api/developer/agents/anthropic-pdf`, { method: "PUT", headers,
        body: JSON.stringify({ ...update, metadata: { ...update.metadata, status: "supported" } }) });
      expect(rejected.status).toBe(400);
      expect((await (await fetch(`${url}/api/agents`)).json())[0].status).toBe("example");
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  });
});
