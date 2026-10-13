import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createServerFixture } from "./test-fixtures/server-fixture.mjs";
const run = promisify(execFile);
describe("startup recovery rejection", () => {
  it("stays alive before the first request, quarantines all endpoints and prints recovery instructions", async () => {
    const fixture = await createServerFixture();
    const journal = join(
      fixture.options.stateDirectory,
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json",
    );
    try {
      await writeFile(journal, "{");
      const script = `
        import { createToolAtlasServer } from ${JSON.stringify(new URL("./server.mjs", import.meta.url).href)};
        const server = createToolAtlasServer(${JSON.stringify(fixture.options)});
        await new Promise(done => setTimeout(done, 100));
        await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
        try {
          const url = 'http://127.0.0.1:' + server.address().port;
          const results = [];
          for (const path of ['/api/health', '/api/catalog', '/api/developer/docs', '/']) {
            const response = await fetch(url + path);
            results.push({status: response.status, body: await response.json()});
          }
          console.log(JSON.stringify(results));
        } finally { await new Promise(done => server.close(done)); }
      `;
      const { stdout, stderr } = await run(
        process.execPath,
        ["--input-type=module", "--eval", script],
        { timeout: 10000 },
      );
      const results = JSON.parse(stdout);
      expect(results).toHaveLength(4);
      for (const result of results)
        expect(result).toMatchObject({ status: 503, body: { code: "RECOVERY_REQUIRED" } });
      expect(stderr).toContain("Back up source and recovery state");
      expect(stderr).toContain(fixture.options.stateDirectory);
      expect(stderr).not.toContain("UnhandledPromiseRejection");
      expect(await readFile(journal, "utf8")).toBe("{");
    } finally {
      await fixture.cleanup();
    }
  }, 15000);
});
