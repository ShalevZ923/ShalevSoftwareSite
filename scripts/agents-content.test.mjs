import { describe, expect, it } from "vitest";
import { loadAgentEntries, validateAgentEntry, validateAgentReleaseRecords } from "./agents-content.mjs";

const guide = "## Overview\n\nExample.\n\n## Support\n\nAsk the owner.";
const metadata = {
  schemaVersion: 1, id: "test-skill", name: "Test Skill", publisher: "Example", packageType: "Skill",
  icon: "TS", updatedAt: "2026-09-22", status: "example", review: { status: "pending" },
  description: "Search and process test files.", highlights: ["File search"], riskLevel: "Unknown", permissions: [],
  capabilities: ["development"], compatibility: [{ target: "agent-skills", status: "unverified", notes: "Untested" }],
  requirements: [], contents: [{ path: "SKILL.md", kind: "skill" }], tags: ["test"],
  maintainer: { name: "Unassigned", team: "Owner needed", initials: "U", email: "owner@example.invalid" },
  releases: [],
};

describe("agent catalog content validation", () => {
  it("accepts metadata-only entries and the checked-in source hierarchy", async () => {
    expect(() => validateAgentEntry("test", metadata, guide)).not.toThrow();
    const entries = await loadAgentEntries();
    expect(entries).toHaveLength(7);
    expect(entries.find((entry) => entry.metadata.id === "atlas-repo-mcp")?.metadata.mcp?.transport).toBe("stdio");
  });
  it("rejects unsupported status claims without provenance and review evidence", () => {
    expect(() => validateAgentEntry("test", { ...metadata, status: "supported" }, guide)).toThrow("supported entries require");
    expect(() => validateAgentEntry("test", { ...metadata, review: { status: "reviewed" } }, guide)).toThrow("reviewed entries require");
  });
  it("rejects unknown capabilities, duplicate targets, and invalid dates", () => {
    expect(() => validateAgentEntry("test", { ...metadata, capabilities: ["other"] }, guide)).toThrow("unknown capability");
    expect(() => validateAgentEntry("test", { ...metadata, compatibility: [...metadata.compatibility, ...metadata.compatibility] }, guide)).toThrow();
    expect(() => validateAgentEntry("test", { ...metadata, updatedAt: "Yesterday" }, guide)).toThrow("updatedAt");
  });
  it("requires an explicit current version when a release is published", () => {
    const release = { version: "1.0", releasedAt: "2026-09-22" };
    expect(validateAgentReleaseRecords([release], "test", metadata.id)).toEqual([release]);
    expect(() => validateAgentEntry("test", { ...metadata, releases: [release] }, guide)).toThrow("currentVersion must reference");
    expect(() => validateAgentEntry("test", { ...metadata, currentVersion: "1.0", releases: [release] }, guide)).not.toThrow();
  });
  it("accepts a supported entry only when review and target evidence match its current version", () => {
    const supported = {
      ...metadata,
      status: "supported",
      riskLevel: "Low",
      currentVersion: "1.0",
      releases: [{ version: "1.0", releasedAt: "2026-09-22" }],
      review: { status: "reviewed", date: "2026-09-22", version: "1.0", evidence: "Internal review ABC-123" },
      source: { url: "https://source.example.org/test-skill", revision: "abc123" },
      license: "Apache-2.0",
      maintainer: { ...metadata.maintainer, email: "owner@example.org" },
      compatibility: [{ target: "agent-skills", status: "verified", notes: "Host smoke test", version: "1.0", verifiedOn: "2026-09-22", evidence: "Internal run ABC-124" }],
    };
    expect(() => validateAgentEntry("test", supported, guide)).not.toThrow();
    expect(() => validateAgentEntry("test", { ...supported, currentVersion: "1.1", releases: [...supported.releases, { version: "1.1", releasedAt: "2026-09-23" }] }, guide)).toThrow("verified compatibility requires");
  });
  it("requires distinct structured MCP tool names and local stdio hosting", () => {
    const mcp = { transport: "stdio", hosting: "local", authentication: "unknown", tools: [
      { name: "read_repo", description: "Read an authorized repository", effect: "read" },
    ], resources: [], prompts: [] };
    const server = { ...metadata, packageType: "MCP Server", mcp };
    expect(() => validateAgentEntry("test", server, guide)).not.toThrow();
    expect(() => validateAgentEntry("test", { ...server, mcp: { ...mcp, tools: [...mcp.tools, ...mcp.tools] } }, guide)).toThrow();
    expect(() => validateAgentEntry("test", { ...server, mcp: { ...mcp, hosting: "remote" } }, guide)).toThrow("local hosting");
  });
  it("allows a reviewed remote MCP configuration without a ZIP, but requires evidence for downloadable releases", () => {
    const remote = {
      ...metadata, packageType: "MCP Server",
      mcp: { transport: "streamable-http", hosting: "remote", authentication: "oauth", tools: [], resources: [], prompts: [] },
      install: { mcp: { name: "test", config: { type: "http", url: "https://mcp.example.internal/api" } } },
    };
    expect(() => validateAgentEntry("test", remote, guide)).not.toThrow();
    expect(() => validateAgentEntry("test", { ...remote, install: { mcp: { name: "test", config: { type: "stdio", command: "test-mcp" } } } }, guide)).toThrow("must match the declared MCP transport");
    const artifact = { version: "1.0", releasedAt: "2026-09-22", artifact: "test-skill/1.0/test-skill-1.0.zip", sha256: "a".repeat(64), archiveRoot: "test-skill", contents: [{ path: "SKILL.md", kind: "skill" }] };
    expect(() => validateAgentReleaseRecords([artifact], "test", metadata.id)).toThrow("requires release review");
    expect(() => validateAgentReleaseRecords([{ ...artifact, review: { date: "2026-09-22", evidence: "Review A-1" } }], "test", metadata.id)).not.toThrow();
    expect(() => validateAgentReleaseRecords([{ ...artifact, archiveRoot: "../escape", review: { date: "2026-09-22", evidence: "Review A-1" } }], "test", metadata.id)).toThrow();
    expect(() => validateAgentEntry("test", { ...metadata, currentVersion: "1.0", releases: [{ ...artifact, review: { date: "2026-09-22", evidence: "Review A-1" } }], install: { unpack: { project: ".agents/skills/other", global: "~/.agents/skills/other" } } }, guide)).toThrow("must match release archiveRoot");
    expect(() => validateAgentEntry("test", { ...metadata, currentVersion: "1.0", releases: [{ ...artifact, contents: [{ path: "OTHER.md", kind: "doc" }], review: { date: "2026-09-22", evidence: "Review A-1" } }] }, guide)).toThrow("current release contents must match");
  });
});
