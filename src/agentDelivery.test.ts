import { describe, expect, it, vi } from "vitest";
import { agentDownloadTarget, canInstallMcpInVsCode, checkArtifactAvailability } from "./agentDelivery";
import type { AgentPackage } from "./agentTypes";

const reviewed = {
  status: "supported", packageType: "MCP Server", currentVersion: "1.0",
  review: { status: "reviewed", version: "1.0", date: "2026-09-24", evidence: "review" },
  source: { url: "https://example.com/source", revision: "pinned" }, license: "MIT", riskLevel: "Low",
  install: { mcp: { name: "test", config: { type: "http", url: "https://mcp.example.internal" } } },
  compatibility: [{ target: "vscode", status: "verified", version: "1.0" }],
} as unknown as AgentPackage;

describe("agent delivery gates", () => {
  it("exposes a ZIP only when the release itself has review evidence", () => {
    const release = { version: "1.0", releasedAt: "2026-09-22", artifact: "test-skill/1.0/test-skill-1.0.zip", sha256: "a".repeat(64), archiveRoot: "test-skill", contents: [{ path: "SKILL.md", kind: "skill" as const }], review: { date: "2026-09-22", evidence: "A-1" } };
    expect(agentDownloadTarget(reviewed, release)?.href).toBe(`/downloads/${release.artifact}`);
    expect(agentDownloadTarget({ ...reviewed, status: "evaluation" }, release)?.href).toBe(`/downloads/${release.artifact}`);
    expect(agentDownloadTarget({ ...reviewed, status: "evaluation", source: undefined }, release)).toBeUndefined();
    expect(agentDownloadTarget(reviewed, { ...release, review: undefined })).toBeUndefined();
    expect(agentDownloadTarget({ ...reviewed, status: "example" }, release)).toBeUndefined();
    expect(canInstallMcpInVsCode(reviewed)).toBe(true);
    expect(canInstallMcpInVsCode({ ...reviewed, compatibility: [] })).toBe(false);
  });
  it("does not mistake a static SPA fallback for a hosted ZIP", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { status: 200, headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=test.zip", "content-length": "2048" } }));
    try {
      expect(await checkArtifactAvailability("/downloads/a.zip")).toEqual({ status: "unavailable" });
      expect(await checkArtifactAvailability("/downloads/a.zip")).toEqual({ status: "available", bytes: 2048 });
    } finally { fetchMock.mockRestore(); }
  });
});
