import { describe, expect, it } from "vitest";
import { createServerFixture } from "./test-fixtures/server-fixture.mjs";
import { createToolAtlasServer, developerToken } from "./server.mjs";
describe("live agent guides", () => {
  it("serves newly created and edited guides without a frontend rebuild", async () => {
    const fixture = await createServerFixture();
    const server = createToolAtlasServer(fixture.options);
    try {
      await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
      const url = `http://127.0.0.1:${server.address().port}`;
      const headers = { Authorization: `Bearer ${developerToken}`, "Content-Type": "application/json" };
      const entries = await (await fetch(url + "/api/developer/agents", { headers })).json();
      const seed = entries.find((entry) => entry.id === "anthropic-pdf");
      const created = await fetch(url + "/api/developer/agents", { method: "POST", headers, body: JSON.stringify({ metadata: { ...seed.metadata, id: "live-guide", packageType: "Role Pack" }, guide: seed.guide + "\n\nNew guide evidence." }) });
      expect(created.status).toBe(201);
      const first = await (await fetch(url + "/api/agents/live-guide/guide")).json();
      expect(first.guide).toContain("New guide evidence.");
      const accepted = await created.json();
      const edited = await fetch(url + "/api/developer/agents/live-guide", { method: "PUT", headers, body: JSON.stringify({ metadata: accepted.agent, revision: accepted.revision, guide: seed.guide + "\n\nEdited guide evidence." }) });
      expect(edited.status).toBe(200);
      const second = await (await fetch(url + "/api/agents/live-guide/guide")).json();
      expect(second.guide).toContain("Edited guide evidence.");
      expect(second.guide).not.toContain("New guide evidence.");
      expect((await fetch(url + "/api/agents/unknown/guide")).status).toBe(404);
      expect((await fetch(url + "/api/agents/bad_id/guide")).status).toBe(404);
    } finally {
      if (server.listening) await new Promise((done) => server.close(done));
      await fixture.cleanup();
    }
  });
});
