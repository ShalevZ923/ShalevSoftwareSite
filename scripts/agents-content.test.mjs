import { describe, expect, it } from "vitest";
import { loadAgentEntries, validateAgentEntry, validateInstall } from "./agents-content.mjs";

const guide = "## Install\n\nInstall it.\n\n## Support\n\nContact the owner.";

const metadata = {
  id: "test-skill",
  order: 1,
  name: "Test Skill",
  publisher: "Example",
  packageType: "Skill",
  icon: "TS",
  updated: "Today",
  description: "A test agent catalog entry.",
  riskLevel: "Low",
  permissions: ["Read the skill files"],
  contents: [{ path: "SKILL.md", kind: "skill" }],
  tags: ["test"],
  maintainer: { name: "Test Owner", team: "Test Team", initials: "TO", email: "owner@example.com" },
  install: {
    unpack: {
      project: ".agents/skills/test-skill",
      global: "~/.agents/skills/test-skill",
    },
  },
  releases: [
    {
      version: "1.0",
      artifact: "test-skill/1.0/test-skill-1.0.zip",
      sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    },
  ],
};

describe("agent install validation", () => {
  it("accepts an internal stdio MCP config", () => {
    expect(() =>
      validateInstall(
        {
          unpack: { project: ".agents/mcp/demo", global: "~/.agents/mcp/demo" },
          mcp: { name: "atlas-repo", config: { type: "stdio", command: "atlas-repo-mcp", args: [] } },
        },
        "test",
        true,
      ),
    ).not.toThrow();
  });

  it("accepts an internal HTTPS MCP URL and rejects public SaaS endpoints", () => {
    expect(() =>
      validateInstall(
        {
          unpack: { project: ".agents/mcp/demo", global: "~/.agents/mcp/demo" },
          mcp: { name: "gitlab", config: { type: "http", url: "https://mcp.gitlab.atlas.local/mcp" } },
        },
        "test",
        true,
      ),
    ).not.toThrow();
    expect(() =>
      validateInstall(
        {
          unpack: { project: ".agents/mcp/demo", global: "~/.agents/mcp/demo" },
          mcp: { name: "Vercel", config: { type: "http", url: "https://mcp.vercel.com" } },
        },
        "test",
        true,
      ),
    ).toThrow("internal MCP host");
  });

  it("rejects npm/npx MCP commands and missing ZIP artifacts", () => {
    expect(() =>
      validateInstall(
        {
          unpack: { project: ".agents/mcp/demo", global: "~/.agents/mcp/demo" },
          mcp: { name: "demo", config: { type: "stdio", command: "npx", args: ["-y", "demo"] } },
        },
        "test",
        true,
      ),
    ).toThrow("cannot use npm, npx");
    expect(() =>
      validateInstall(
        { unpack: { project: ".agents/skills/demo", global: "~/.agents/skills/demo" } },
        "test",
        false,
      ),
    ).toThrow("ZIP artifact release");
  });
});

describe("agent entry validation", () => {
  it("accepts a complete skill record", () => {
    expect(() => validateAgentEntry("test-skill", metadata, guide)).not.toThrow();
  });

  it("rejects parent-directory content paths, public downloads, and unknown risk levels", () => {
    expect(() =>
      validateAgentEntry("test-skill", { ...metadata, contents: [{ path: "../secret", kind: "script" }] }, guide),
    ).toThrow("relative file path");
    expect(() =>
      validateAgentEntry(
        "test-skill",
        { ...metadata, releases: [{ version: "1.0", download: "https://github.com/example/skill.zip" }] },
        guide,
      ),
    ).toThrow("same-server ZIP artifact");
    expect(() => validateAgentEntry("test-skill", { ...metadata, riskLevel: "Critical" }, guide)).toThrow(
      "riskLevel must be Low, Medium, or High",
    );
  });
});

describe("hierarchical agent catalog source", () => {
  it("assembles packages from type, publisher, guide, and per-version release files", async () => {
    const entries = await loadAgentEntries();
    const pdf = entries.find(({ metadata: item }) => item.id === "anthropic-pdf");
    expect(pdf?.metadata).toMatchObject({
      publisher: "Anthropic",
      packageType: "Skill",
      install: {
        unpack: { project: ".agents/skills/pdf", global: "~/.agents/skills/pdf" },
      },
      releases: expect.arrayContaining([
        {
          version: "1.0",
          artifact: "anthropic-pdf/1.0/anthropic-pdf-1.0.zip",
          sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        },
      ]),
    });
    expect(pdf?.guide).toContain("## Install");
  });
});
