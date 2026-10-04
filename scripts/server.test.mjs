import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { request } from "node:http";
import { assertSafeBindHost, createToolAtlasServer, developerToken } from "./server.mjs";

describe("Tool Atlas Self-Contained Server", () => {
  let server;
  let baseUrl;
  let fixtureRoot;
  let fixturePackages;

  beforeAll(async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "tool-atlas-server-test-"));
    const fixtureDist = join(fixtureRoot, "dist");
    fixturePackages = join(fixtureRoot, "packages");
    await mkdir(fixtureDist);
    await mkdir(fixturePackages);
    await writeFile(join(fixtureDist, "index.html"), '<div id="root"></div>', "utf8");
    await writeFile(join(fixtureRoot, "dist-secret.txt"), "must not be served", "utf8");

    server = createToolAtlasServer({
      distDirectory: fixtureDist,
      packagesDirectory: fixturePackages,
    });
    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  it("serves health check on GET /api/health", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });

  it("serves live dynamic catalog on GET /api/catalog", async () => {
    const res = await fetch(`${baseUrl}/api/catalog`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.tools)).toBe(true);
    expect(data.tools.length).toBeGreaterThan(0);
    expect(typeof data.docs).toBe("object");
    expect(data.docs["docker"]).toBeDefined();
  });

  it("rejects invalid developer token on POST /api/developer/verify", async () => {
    const res = await fetch(`${baseUrl}/api/developer/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid-token-here" }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it("rejects oversized unauthenticated JSON without retaining it", async () => {
    const res = await fetch(`${baseUrl}/api/developer/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(2 * 1024 * 1024 + 1),
    });
    expect(res.status).toBe(413);
  });

  it("verifies valid ephemeral developer token on POST /api/developer/verify", async () => {
    const res = await fetch(`${baseUrl}/api/developer/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: developerToken }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it("blocks protected developer routes when unauthenticated", async () => {
    const res = await fetch(`${baseUrl}/api/developer/tools`);
    expect(res.status).toBe(401);
  });

  it("does not accept developer tokens from query strings", async () => {
    const res = await fetch(`${baseUrl}/api/developer/tools?token=${developerToken}`);
    expect(res.status).toBe(401);
  });

  it("requires an explicit TLS-proxy assertion for non-loopback binds", () => {
    expect(() => assertSafeBindHost("127.0.0.1")).not.toThrow();
    expect(() => assertSafeBindHost("0.0.0.0")).toThrow(/Refusing a non-loopback bind/);
    expect(() => assertSafeBindHost("0.0.0.0", true)).not.toThrow();
    expect(() => assertSafeBindHost("0.0.0.0", false, true)).not.toThrow();
    expect(() => assertSafeBindHost("192.168.1.10", false, true)).toThrow(/Refusing a non-loopback bind/);
  });

  it("uses short request timeouts for the optional authoring server", () => {
    expect(server.headersTimeout).toBe(10_000);
    expect(server.requestTimeout).toBe(15_000);
    expect(server.keepAliveTimeout).toBe(5_000);
  });

  it("allows access to developer tools with Bearer token", async () => {
    const res = await fetch(`${baseUrl}/api/developer/tools`, {
      headers: {
        Authorization: `Bearer ${developerToken}`,
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((t) => t.id === "docker")).toBe(true);
  });

  it("reads a single tool with guide content", async () => {
    const res = await fetch(`${baseUrl}/api/developer/tools/docker`, {
      headers: {
        Authorization: `Bearer ${developerToken}`,
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.metadata.id).toBe("docker");
    expect(data.guide).toContain("## Install");
    expect(data.guide).toContain("## Support");
  });

  it("returns a validation error instead of a server failure for an invalid tool update", async () => {
    const existing = await fetch(`${baseUrl}/api/developer/tools/intellij`, {
      headers: { Authorization: `Bearer ${developerToken}` },
    });
    const entry = await existing.json();
    entry.metadata.releases[0].version = "";

    const res = await fetch(`${baseUrl}/api/developer/tools/intellij`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${developerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entry),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("releases[0].version");
  });

  it("lists and reads documentation files", async () => {
    const listRes = await fetch(`${baseUrl}/api/developer/docs`, {
      headers: {
        Authorization: `Bearer ${developerToken}`,
      },
    });
    expect(listRes.status).toBe(200);
    const docsList = await listRes.json();
    expect(Array.isArray(docsList)).toBe(true);
    expect(docsList.some((d) => d.name === "WINDOWS_DEPLOYMENT.md")).toBe(true);

    const docRes = await fetch(`${baseUrl}/api/developer/docs/WINDOWS_DEPLOYMENT.md`, {
      headers: {
        Authorization: `Bearer ${developerToken}`,
      },
    });
    expect(docRes.status).toBe(200);
    const docData = await docRes.json();
    expect(docData.name).toBe("WINDOWS_DEPLOYMENT.md");
    expect(docData.content).toContain("# Windows deployment");
  });

  it("prevents directory traversal on docs endpoints", async () => {
    const res = await fetch(`${baseUrl}/api/developer/docs/..%2fpackage.json`, {
      headers: {
        Authorization: `Bearer ${developerToken}`,
      },
    });
    expect(res.status).toBe(404);
  });

  it.each(["%", "%G0", "%FF", "%E0%A4%A"])(
    "rejects malformed URI encoding %s without terminating the server",
    async (encoding) => {
      const malformed = await fetch(`${baseUrl}/${encoding}`);
      expect(malformed.status).toBe(400);

      const health = await fetch(`${baseUrl}/api/health`);
      expect(health.status).toBe(200);
    },
  );

  it("rejects an invalid Host header without terminating the server", async () => {
    const status = await new Promise((resolve, reject) => {
      const req = request(`${baseUrl}/`, { headers: { Host: "[" } }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      });
      req.on("error", reject);
      req.end();
    });
    expect(status).toBe(400);

    const health = await fetch(`${baseUrl}/api/health`);
    expect(health.status).toBe(200);
  });

  it("does not serve files from a dist-prefixed sibling directory", async () => {
    const res = await fetch(`${baseUrl}/%2e%2e%2fdist-secret.txt`);
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("must not be served");
  });

  it.runIf(process.platform !== "win32")(
    "does not follow static-file symlinks outside dist",
    async () => {
      const outsideFile = join(fixtureRoot, "outside-secret.txt");
      await writeFile(outsideFile, "must not cross the static root", "utf8");
      await symlink(outsideFile, join(fixtureRoot, "dist", "linked-secret.txt"));

      const res = await fetch(`${baseUrl}/linked-secret.txt`);
      expect(res.status).toBe(403);
      expect(await res.text()).not.toContain("must not cross the static root");
    },
  );

  it.runIf(process.platform !== "win32")(
    "does not follow download symlinks outside the package root",
    async () => {
      const outsideFile = join(fixtureRoot, "outside-installer.msi");
      const packageVersion = join(fixturePackages, "test-tool", "1.0");
      await writeFile(outsideFile, "must not cross the package root", "utf8");
      await mkdir(packageVersion, { recursive: true });
      await symlink(outsideFile, join(packageVersion, "linked.msi"));

      const res = await fetch(`${baseUrl}/downloads/test-tool/1.0/linked.msi`);
      expect(res.status).toBe(403);
      expect(await res.text()).not.toContain("must not cross the package root");
    },
  );

  it("serves static index.html and SPA fallback with security headers", async () => {
    const res = await fetch(`${baseUrl}/some-random-route`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    const html = await res.text();
    expect(html).toContain('<div id="root"></div>');
  });

  it("blocks direct access to /_headers file", async () => {
    const res = await fetch(`${baseUrl}/_headers`);
    expect(res.status).toBe(404);
  });
});
