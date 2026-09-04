import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createToolAtlasServer, developerToken } from "./server.mjs";

describe("Tool Atlas Self-Contained Server", () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    server = createToolAtlasServer();
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

  it("serves static index.html and SPA fallback with security headers", async () => {
    const res = await fetch(`${baseUrl}/some-random-route`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    const html = await res.text();
    expect(html).toContain('<div id="root"></div>');
  });

  it("blocks direct access to /_headers file", async () => {
    const res = await fetch(`${baseUrl}/_headers`);
    expect(res.status).toBe(404);
  });
});
