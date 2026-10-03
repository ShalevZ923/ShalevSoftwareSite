import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createToolAtlasServer, developerToken } from "./server.mjs";

describe("guide delivery and credential HTTP contracts", () => {
  let root;
  let server;
  let baseUrl;
  const payload = Buffer.from("approved guide fixture\n");

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "tool-atlas-contract-"));
    const library = join(root, "guide-library");
    await mkdir(join(library, "test-tool"), { recursive: true });
    for (const extension of ["pdf", "pptx"]) {
      await writeFile(join(library, "test-tool", `setup.${extension}`), payload);
    }
    await writeFile(join(root, "secret.pdf"), "outside library");
    if (process.platform !== "win32") {
      await symlink(join(root, "secret.pdf"), join(library, "test-tool", "escape.pdf"));
    }
    const dist = join(root, "dist");
    await mkdir(dist);
    await writeFile(join(dist, "index.html"), "<div>SPA fixture</div>");
    server = createToolAtlasServer({ guideLibraryDirectory: library, distDirectory: dist });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (root) await rm(root, { recursive: true, force: true });
  });

  it.each([
    ["pdf", "application/pdf"],
    ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ])("serves approved %s guides on GET and HEAD", async (extension, mime) => {
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(`${baseUrl}/guides/test-tool/setup.${extension}`, { method });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(mime);
      expect(response.headers.get("content-disposition")).toBe(`inline; filename="setup.${extension}"`);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      const body = Buffer.from(await response.arrayBuffer());
      expect(body).toEqual(method === "HEAD" ? Buffer.alloc(0) : payload);
    }
  });

  it.each(["GET", "HEAD"])("returns 404 for missing guides on %s", async (method) => {
    const response = await fetch(`${baseUrl}/guides/test-tool/missing.pdf`, { method });
    expect(response.status).toBe(404);
    if (method === "HEAD") expect(await response.text()).toBe("");
  });

  it.runIf(process.platform !== "win32")("blocks guide symlinks outside the library", async () => {
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(`${baseUrl}/guides/test-tool/escape.pdf`, { method });
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("outside library");
    }
  });

  it.each([
    "null", '{"token":123}', '{"token":{}}', '{"token":[]}', '{"token":true}',
    '{"token":null}', '[]', '123', '"token"', '{', '{}', '{"token":"wrong"}',
  ])("rejects invalid credential JSON %s", async (body) => {
    const response = await fetch(`${baseUrl}/api/developer/verify`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ valid: false });
    expect((await fetch(`${baseUrl}/api/health`)).status).toBe(200);
  });

  it.each([{}, { token: "" }])("preserves Bearer fallback for %j", async (body) => {
    const response = await fetch(`${baseUrl}/api/developer/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${developerToken}` },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: true });
  });

  it("accepts a valid string token", async () => {
    const response = await fetch(`${baseUrl}/api/developer/verify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: developerToken }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: true });
  });

  it("preserves the 413 body limit even with valid Bearer credentials", async () => {
    const response = await fetch(`${baseUrl}/api/developer/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${developerToken}` },
      body: "x".repeat(2 * 1024 * 1024 + 1),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ valid: false });
  });
  it.each(["GET", "HEAD", "OPTIONS", "POST"])("reserves unknown API routes for JSON 404 on %s", async (method) => {
    const response = await fetch(`${baseUrl}/api/not-an-endpoint`, { method });
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    if (method === "HEAD") expect(await response.text()).toBe("");
    else expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it.each([
    ["/api/health", "GET"], ["/api/catalog", "GET"],
    ["/api/developer/verify", "POST"], ["/api/developer/tools", "GET, POST"],
    ["/api/developer/tools/docker", "GET, PUT"], ["/api/developer/docs", "GET"],
    ["/api/developer/docs/README.md", "GET, PUT"], ["/api/developer/guide-library/docker", "GET"],
  ])("rejects unsupported methods with accurate Allow for %s", async (path, allow) => {
    for (const method of ["HEAD", "OPTIONS", "DELETE"]) {
      const response = await fetch(`${baseUrl}${path}`, {
        method, headers: { Authorization: `Bearer ${developerToken}` },
      });
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe(allow);
      expect(response.headers.get("content-type")).toContain("application/json");
      if (method === "HEAD") expect(await response.text()).toBe("");
    }
  });

  it.each(["/api/developer/tools", "/api/developer/not-an-endpoint"])("authenticates before exposing route details for %s", async (path) => {
    const response = await fetch(`${baseUrl}${path}`, { method: "OPTIONS" });
    expect(response.status).toBe(401);
    expect(response.headers.get("allow")).toBeNull();
  });

  it("keeps ordinary SPA deep links working", async () => {
    const response = await fetch(`${baseUrl}/documentation/deep-link`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("SPA fixture");
  });

});
