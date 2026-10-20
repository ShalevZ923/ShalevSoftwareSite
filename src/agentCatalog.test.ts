import { describe, expect, it } from "vitest";
import { agents, type AgentPackage } from "./agents";
import {
  agentFiltersFromSearch, agentFiltersToSearch, defaultAgentFilters, getAgentCatalog,
  getRecentAgentUpdates, paginateAgents,
} from "./agentCatalog";

const pdf = agents.find((item) => item.id === "anthropic-pdf")!;

describe("agent discovery", () => {
  it("finds descriptions, capabilities, MCP tools, and all query terms", () => {
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, query: "scanned documents" }).map((a) => a.id)).toEqual(["anthropic-pdf"]);
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, query: "repository search" }).map((a) => a.id)).toEqual(["atlas-repo-mcp"]);
    expect(getAgentCatalog([{ ...pdf, highlights: ["Zebra workflows"] }], { ...defaultAgentFilters, query: "zebra" }).map((a) => a.id)).toEqual(["anthropic-pdf"]);
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, query: "PDF GitLab" })).toEqual([]);
  });

  it("combines structured filters and sorts by ISO date rather than source order", () => {
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, packageType: "MCP Server", capability: "repository-access" }).map((a) => a.id)).toEqual(["atlas-repo-mcp"]);
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, capability: "documents" }).map((a) => a.id)).toEqual(["internal-comms", "anthropic-pdf", "theme-factory", "workplace-content-pack"]);
    expect(getAgentCatalog(agents, { ...defaultAgentFilters, status: "supported" })).toEqual([]);
    const older: AgentPackage = { ...pdf, id: "old", name: "Old", updatedAt: "2025-01-01" };
    const newer: AgentPackage = { ...pdf, id: "new", name: "New", updatedAt: "2026-01-01" };
    expect(getRecentAgentUpdates([older, newer]).map((a) => a.id)).toEqual(["new", "old"]);
  });

  it("shares validated filters and places a direct-link target on its result page", () => {
    const search = agentFiltersToSearch({ ...defaultAgentFilters, query: " pdf ", packageType: "Skill", capability: "documents", status: "example" });
    expect(agentFiltersFromSearch(`?${search}`, ["Skill"], ["Anthropic"])).toMatchObject({ query: "pdf", packageType: "Skill", capability: "documents", status: "example" });
    expect(agentFiltersFromSearch("?capability=bogus&target=bogus&status=bogus", [], [])).toEqual(defaultAgentFilters);
    const many = Array.from({ length: 45 }, (_, index) => ({ ...pdf, id: `pdf-${index}`, name: `PDF ${index}` }));
    expect(paginateAgents(many, 1, "pdf-24")).toMatchObject({ page: 2, pageCount: 3 });
    expect(paginateAgents(many, 100).page).toBe(3);
  });

  it("keeps the seeded examples visibly unapproved", () => {
    const exampleIds = ["anthropic-pdf", "atlas-repo-mcp", "openai-developers"];
    expect(agents.filter((agent) => exampleIds.includes(agent.id)).every((agent) => agent.status === "example" && agent.review.status === "pending" && agent.releases.length === 0)).toBe(true);
    expect(agents.filter((agent) => agent.status === "evaluation").map((agent) => agent.id).sort()).toEqual(["internal-comms", "mcp-server-time", "theme-factory", "workplace-content-pack"]);
  });
});
