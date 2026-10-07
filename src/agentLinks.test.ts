import { describe, expect, it } from "vitest";
import { agents, type AgentPackage } from "./agents";
import { defaultAgentFilters } from "./agentCatalog";
import { getReleaseDownloadTarget } from "./downloads";
import { agentPageHref, agentTargetFromSearch, resolveAgentRelease } from "./agentLinks";

const agent: AgentPackage = {
  ...agents.find((item) => item.id === "anthropic-pdf")!,
  releases: [
    {
      version: "1.0",
      artifact: "anthropic-pdf/1.0/anthropic-pdf-1.0.zip",
      sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    },
    {
      version: "0.9",
      artifact: "anthropic-pdf/0.9/skill.zip",
      sha256: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    },
  ],
};

describe("agent navigation links", () => {
  it("creates agent catalog URLs with optional encoded versions", () => {
    expect(agentPageHref("anthropic-pdf")).toBe("?page=agents&agent=anthropic-pdf");
    const params = new URLSearchParams(agentPageHref("anthropic-pdf", "1.0+build.1"));
    expect(params.get("page")).toBe("agents");
    expect(params.get("agent")).toBe("anthropic-pdf");
    expect(params.get("version")).toBe("1.0+build.1");
  });

  it("selects the linked release and its actual download target", () => {
    const link = agentTargetFromSearch(agentPageHref(agent.id, "0.9"), [agent]);
    expect(link.target).toEqual({ agentId: "anthropic-pdf", version: "0.9" });
    expect(link.unavailableVersion).toBe(false);
    expect(getReleaseDownloadTarget(resolveAgentRelease(agent, link.target?.version))?.href).toBe(
      "/downloads/anthropic-pdf/0.9/skill.zip",
    );
  });

  it("falls back to the first approved release, never a URL supplied as a version", () => {
    for (const version of ["retired", "https://untrusted.example/install.zip"]) {
      const link = agentTargetFromSearch(agentPageHref(agent.id, version), [agent]);
      expect(link.target?.version).toBe("1.0");
      expect(link.unavailableVersion).toBe(true);
      expect(getReleaseDownloadTarget(resolveAgentRelease(agent, version))?.href).toBe(
        "/downloads/anthropic-pdf/1.0/anthropic-pdf-1.0.zip",
      );
    }
  });

  it("does not open an unrelated package when a link is stale", () => {
    expect(agentTargetFromSearch("?page=agents&agent=removed&version=1.0", [agent])).toMatchObject({
      target: null,
      missingAgent: true,
      unavailableVersion: false,
    });
  });

  it("clears conflicting filters but preserves filters that include the destination", () => {
    expect(
      agentTargetFromSearch("?page=agents&agent=anthropic-pdf&query=gitlab&publisher=Internal", [agent]).filters,
    ).toEqual(defaultAgentFilters);
    expect(
      agentTargetFromSearch("?page=agents&agent=anthropic-pdf&query=pdf&publisher=Anthropic", [agent]).filters,
    ).toMatchObject({ query: "pdf", publisher: "Anthropic" });
  });
});
