import { describe, expect, it } from "vitest";
import {
  agentReleaseSha256,
  isZipDownloadTarget,
  mcpInstallHref,
  mcpInstallPayload,
  unpackPathForScope,
} from "./agentInstall";

const mcp = {
  name: "atlas-repo",
  config: {
    type: "stdio",
    command: "atlas-repo-mcp",
    args: [],
  },
};

describe("agent install helpers", () => {
  it("builds vscode and insiders MCP install links from reviewed config only", () => {
    const payload = mcpInstallPayload(mcp);
    expect(payload).toEqual({
      name: "atlas-repo",
      type: "stdio",
      command: "atlas-repo-mcp",
      args: [],
    });
    expect(mcpInstallHref(mcp)).toBe(`vscode:mcp/install?${encodeURIComponent(JSON.stringify(payload))}`);
    expect(mcpInstallHref(mcp, "vscode-insiders")).toBe(
      `vscode-insiders:mcp/install?${encodeURIComponent(JSON.stringify(payload))}`,
    );
  });

  it("URL-encodes JSON so query delimiters cannot split the payload", () => {
    const href = mcpInstallHref({
      name: "demo",
      config: { command: "atlas-repo-mcp", args: ["--flag", "a&x=1"] },
    });
    expect(href.startsWith("vscode:mcp/install?")).toBe(true);
    expect(href).not.toContain("&x=");
    expect(JSON.parse(decodeURIComponent(href.slice("vscode:mcp/install?".length)))).toEqual({
      name: "demo",
      command: "atlas-repo-mcp",
      args: ["--flag", "a&x=1"],
    });
  });

  it("selects project or global unpack paths", () => {
    const install = {
      unpack: {
        project: ".agents/skills/pdf",
        global: "~/.agents/skills/pdf",
      },
    };
    expect(unpackPathForScope(install, "project")).toBe(install.unpack.project);
    expect(unpackPathForScope(install, "global")).toBe(install.unpack.global);
  });

  it("accepts SHA-256 digests and detects same-origin ZIP downloads", () => {
    expect(agentReleaseSha256("2CF24DBA5FB0A30E26E83B2AC5B9E29E1B161E5C1FA7425E73043362938B9824")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
    expect(agentReleaseSha256("not-a-hash")).toBeUndefined();
    expect(
      isZipDownloadTarget({
        href: "/downloads/anthropic-pdf/1.0/anthropic-pdf-1.0.zip",
        external: false,
        filename: "anthropic-pdf-1.0.zip",
      }),
    ).toBe(true);
    expect(
      isZipDownloadTarget({
        href: "https://gitlab.atlas.local/docs/mcp",
        external: true,
      }),
    ).toBe(false);
  });
});
