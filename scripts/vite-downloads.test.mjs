import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer as createHttpServer } from "node:http";
import { createServer as createViteServer } from "vite";
import { resolve } from "node:path";

let backend;
let vite;
let baseUrl;
const seen = [];

beforeAll(async () => {
  backend = createHttpServer((request, response) => {
    seen.push(`${request.method} ${request.url}`);
    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.end(request.method === "HEAD" ? undefined : "installer fixture");
  });
  await new Promise((done) => backend.listen(0, "127.0.0.1", done));
  vite = await createViteServer({
    configFile: resolve("vite.config.ts"),
    server: {
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
      proxy: { "/downloads": `http://127.0.0.1:${backend.address().port}` },
    },
    logLevel: "silent",
  });
  await vite.listen();
  baseUrl = `http://127.0.0.1:${vite.httpServer.address().port}`;
});

afterAll(async () => {
  await vite?.close();
  if (backend?.listening) await new Promise((done) => backend.close(done));
});

describe("Vite Studio downloads", () => {
  it.each(["exe", "msi", "msix", "dmg", "pkg", "deb", "rpm"])(
    "forwards %s installers to the local server for GET and HEAD",
    async (extension) => {
      const path = `/downloads/tool/1.0/installer.${extension}`;
      const response = await fetch(baseUrl + path);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("installer fixture");
      expect((await fetch(baseUrl + path, { method: "HEAD" })).status).toBe(200);
      expect(seen).toContain(`GET ${path}`);
      expect(seen).toContain(`HEAD ${path}`);
    },
  );

  it("does not forward withheld agent ZIPs to the local server", async () => {
    const path = "/downloads/unknown/1.0/withheld.zip";
    expect((await fetch(baseUrl + path)).status).toBe(404);
    expect(seen).not.toContain(`GET ${path}`);
  });
});
