import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const nginxPath = resolve(import.meta.dirname, "../../deploy/docker/nginx.conf");

describe("NGINX origin forwarding", () => {
  it("trusts X-Forwarded-For only from private Docker peers", async () => {
    const nginx = await readFile(nginxPath, "utf8");
    expect(nginx).not.toMatch(/set_real_ip_from 0\.0\.0\.0\/0/);
    expect(nginx).not.toMatch(/set_real_ip_from ::\/0/);
    expect(nginx).toMatch(/set_real_ip_from 10\.0\.0\.0\/8/);
    expect(nginx).toMatch(/set_real_ip_from 172\.16\.0\.0\/12/);
    expect(nginx).toMatch(/set_real_ip_from 192\.168\.0\.0\/16/);
    expect(nginx).toMatch(/set_real_ip_from ::1/);
    expect(nginx).toMatch(/set_real_ip_from fc00::\/7/);
    expect(nginx).toMatch(/real_ip_header X-Forwarded-For/);
    expect(nginx).toMatch(/real_ip_recursive on/);
  });

  it("serves local guide library artifacts with traversal and symlink protection", async () => {
    const nginx = await readFile(nginxPath, "utf8");
    expect(nginx).toMatch(/location = \/guides \{ return 404; \}/);
    expect(nginx).toMatch(/location \^~ \/guides\//);
    expect(nginx).toMatch(/alias \/srv\/tool-atlas-guides\/;/);
    expect(nginx).toMatch(/autoindex off;/);
    expect(nginx).toMatch(/disable_symlinks on;/);
  });
});
