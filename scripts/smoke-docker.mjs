import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

// Requires local Docker and two already-built images. Never print Studio logs:
// retrieve the startup credential in memory and exercise it without disclosing it.
const [staticImage = "tool-atlas:ci", studioImage = "tool-atlas:studio-ci"] = process.argv.slice(2);
const caddyImage = "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d";
const fixture = mkdtempSync(join(tmpdir(), "atlas-container-smoke-"));
const prefix = `atlas-smoke-${process.pid}`;
const network = `${prefix}-network`;
const containers = [];
function docker(...args) {
  try {
    return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    // Docker errors can include log output; keep credential-bearing text out of CI.
    throw new Error(`Docker ${args[0]} failed`);
  }
}
function launch(name, options, image, command = []) {
  containers.push(name);
  docker("run", "--detach", "--name", name, ...options, image, ...command);
  return name;
}
function urlFor(name, port) {
  const address = docker("port", name, `${port}/tcp`);
  assert.match(address, /^127\.0\.0\.1:\d+$/);
  return `http://${address}`;
}
async function waitReady(url) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        assert.deepEqual(await response.json(), { status: "ok" });
        return;
      }
    } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Container health endpoint did not become ready");
}
async function verifyToken(url, token) {
  return fetch(`${url}/api/developer/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}
function currentToken(name) {
  const tokens = [...docker("logs", name).matchAll(/\n\s+([a-f0-9]{64})\s*\n/g)];
  assert.ok(tokens.length, "Startup token must be present in local container logs");
  return tokens.at(-1)[1];
}
try {
  // Compose applies its default for both absent and explicitly empty settings.
  const environment = { ...process.env, SITE_DOMAIN: "", ACME_EMAIL: "" };
  const publicConfig = JSON.parse(execFileSync("docker", ["compose", "--env-file", "/dev/null", "config", "--format", "json"], { encoding: "utf8", env: environment }));
  assert.equal(publicConfig.services.proxy.environment.SITE_DOMAIN, ":80");
  assert.equal(publicConfig.services.proxy.environment.ACME_EMAIL, "");
  assert.equal(publicConfig.services.studio, undefined);
  const localConfig = JSON.parse(execFileSync("docker", ["compose", "-f", "compose.studio.yaml", "--env-file", "/dev/null", "config", "--format", "json"], { encoding: "utf8", env: environment }));
  assert.equal(localConfig.services.studio.ports[0].host_ip, "127.0.0.1");
  for (const dir of ["content", "src/generated", "public/catalog/v1", "docs"]) {
    cpSync(resolve(dir), join(fixture, dir), { recursive: true });
  }
  for (const dir of ["guide-library", "packages"]) mkdirSync(join(fixture, dir));
  docker("network", "create", network);
  const app = launch(`${prefix}-app`, [
    "--network", network, "--network-alias", "app", "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m", "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges:true",
  ], staticImage);
  assert.equal(docker("exec", app, "sh", "-c", "command -v node || true"), "");
  for (const [domain, email] of [[":80", ""], ["atlas.example.com", ""], ["atlas.example.com", "ops@example.com"]]) {
    docker("run", "--rm", "--env", `SITE_DOMAIN=${domain}`, "--env", `ACME_EMAIL=${email}`,
      "--volume", `${resolve("Caddyfile")}:/etc/caddy/Caddyfile:ro`, caddyImage,
      "caddy", "validate", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile");
  }
  const proxy = launch(`${prefix}-proxy`, [
    "--network", network, "--publish", "127.0.0.1::80", "--env", "SITE_DOMAIN=:80", "--env", "ACME_EMAIL=",
    "--volume", `${resolve("Caddyfile")}:/etc/caddy/Caddyfile:ro`,
  ], caddyImage);
  const publicUrl = urlFor(proxy, 80);
  await waitReady(publicUrl);
  const appResponse = await fetch(publicUrl);
  assert.equal(appResponse.status, 200);
  assert.match(await appResponse.text(), /id="root"/);
  assert.ok(!appResponse.headers.get("content-security-policy").includes("upgrade-insecure-requests"));
  assert.equal(appResponse.headers.get("strict-transport-security"), null);
  const tlsHeaders = docker("exec", app, "sh", "-c", "wget -S -O /dev/null --header='X-Forwarded-Proto: https' http://127.0.0.1:8080/ 2>&1");
  assert.match(tlsHeaders, /upgrade-insecure-requests/);
  console.log("PASS: static image has no Node runtime; empty Caddy settings serve app and JSON health over HTTP");
  const mounts = ["content", "src/generated", "public/catalog/v1", "docs", "guide-library", "packages"];
  const studio = launch(`${prefix}-studio`, [
    "--publish", "127.0.0.1::8080", "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
    "--user", `${process.getuid()}:${process.getgid()}`,
    "--env", "HOST=0.0.0.0", "--env", "TOOL_ATLAS_LOCAL_CONTAINER=true",
    ...mounts.flatMap((dir) => ["--volume", `${join(fixture, dir)}:/app/${dir}${["guide-library", "packages"].includes(dir) ? ":ro" : ""}`]),
  ], studioImage);
  let studioUrl = urlFor(studio, 8080);
  await waitReady(studioUrl);
  const token = currentToken(studio);
  assert.equal((await verifyToken(studioUrl, token)).status, 200);
  const docUrl = `${studioUrl}/api/developer/docs/CONTAINER_SMOKE.md`;
  const body = JSON.stringify({ content: "# Persistent container edit\n" });
  assert.equal((await fetch(docUrl, { method: "PUT", headers: { "Content-Type": "application/json" }, body })).status, 401);
  assert.equal((await fetch(docUrl, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body })).status, 200);
  assert.equal(readFileSync(join(fixture, "docs/CONTAINER_SMOKE.md"), "utf8"), "# Persistent container edit\n");
  docker("restart", studio);
  studioUrl = urlFor(studio, 8080);
  await waitReady(studioUrl);
  assert.equal((await verifyToken(studioUrl, token)).status, 401);
  assert.equal((await verifyToken(studioUrl, currentToken(studio))).status, 200);
  assert.equal((await fetch(`${studioUrl}/api/developer/docs/CONTAINER_SMOKE.md`, { headers: { Authorization: `Bearer ${currentToken(studio)}` } })).status, 200);
  console.log("PASS: Studio token is retrievable from logs, protects persistent saves, and rotates on restart");
} finally {
  for (const name of containers.reverse()) {
    try { docker("rm", "--force", name); } catch {}
  }
  try { docker("network", "rm", network); } catch {}
  rmSync(fixture, { recursive: true, force: true });
}
