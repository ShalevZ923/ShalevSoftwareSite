import { describe, expect, it } from "vitest";
import { agents } from "./agents";
import {
  agentFiltersFromSearch,
  agentFiltersToSearch,
  defaultAgentFilters,
  getAgentCatalog,
  getRecentAgentUpdates,
} from "./agentCatalog";

describe("agent catalog filters", () => {
  it("matches names, publishers, tags, and permissions without case sensitivity", () => {
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, query: "anthropic" }).map((agent) => agent.id)).toEqual([
      "anthropic-pdf",
    ]);
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, query: "gitlab" }).map((agent) => agent.id)).toEqual([
      "atlas-repo-mcp",
    ]);
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, publisher: "OpenAI" }).map((agent) => agent.id)).toEqual([
      "openai-developers",
    ]);
  });

  it("keeps agent catalog content complete and safe to publish as static data", () => {
    expect(new Set(agents.map((agent) => agent.id)).size).toBe(agents.length);
    expect(agents.length).toBeGreaterThan(0);

    for (const agent of agents) {
      expect(agent.id).toMatch(/^[a-z0-9-]+$/);
      expect(agent.name).not.toHaveLength(0);
      expect(agent.maintainer.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(agent.releases).not.toHaveLength(0);
      expect(agent.contents.length).toBeGreaterThan(0);
      expect(agent.permissions.length).toBeGreaterThan(0);
      expect(agent.install.unpack.project).toMatch(/^\.agents\//);
      expect(agent.install.unpack.global).toMatch(/^~\/\.agents\//);
      expect(agent.facts?.some((fact) => /key|activation|password|token/i.test(fact.label))).not.toBe(true);
      for (const release of agent.releases) {
        expect(release.artifact).toMatch(
          new RegExp(`^${agent.id}/${release.version.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}/[A-Za-z0-9][A-Za-z0-9._-]*\\.zip$`),
        );
        expect(release.sha256).toMatch(/^[a-f0-9]{64}$/);
      }
    }
  });

  it("combines filters and preserves a predictable sort order", () => {
    expect(
      getAgentCatalog(agents, { ...defaultAgentFilters, packageType: "MCP Server" }).map((agent) => agent.id),
    ).toEqual(["atlas-repo-mcp"]);
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, risk: "High" }).map((agent) => agent.id)).toEqual([
      "openai-developers",
    ]);
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, sort: "updated" }).map((agent) => agent.id)).toEqual([
      "atlas-repo-mcp",
      "anthropic-pdf",
      "openai-developers",
    ]);
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, sort: "type" }).map((agent) => agent.packageType)).toEqual([
      "Agent Pack",
      "MCP Server",
      "Skill",
    ]);
  });

  it("creates compact, validated shareable filter URLs", () => {
    const search = agentFiltersToSearch({
      ...defaultAgentFilters,
      query: " pdf ",
      packageType: "Skill",
      publisher: "Anthropic",
      sort: "updated",
    });
    expect(search).toBe("query=pdf&type=Skill&publisher=Anthropic&sort=updated");
    expect(agentFiltersFromSearch(`?${search}`, ["All types", "Skill"], ["All publishers", "Anthropic"])).toEqual({
      ...defaultAgentFilters,
      query: "pdf",
      packageType: "Skill",
      publisher: "Anthropic",
      sort: "updated",
    });
    expect(
      agentFiltersFromSearch("?type=Unknown&publisher=Unknown&risk=Critical&sort=random", ["All types", "Skill"], [
        "All publishers",
        "Anthropic",
      ]),
    ).toEqual(defaultAgentFilters);
  });

  it("ranks recent updates newest first", () => {
    expect(getRecentAgentUpdates(agents).map((agent) => agent.id)).toEqual([
      "atlas-repo-mcp",
      "anthropic-pdf",
      "openai-developers",
    ]);
  });
});
