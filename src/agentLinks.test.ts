import { describe, expect, it } from "vitest";
import { agents, type AgentPackage } from "./agents";
import { defaultAgentFilters } from "./agentCatalog";
import { agentPageHref, agentTargetFromSearch, resolveAgentRelease } from "./agentLinks";

const listing = agents.find((item) => item.id === "anthropic-pdf")!;
const released: AgentPackage = {
  ...listing, currentVersion: "1.0", releases: [
    { version: "0.9", releasedAt: "2025-01-01" },
    { version: "1.0", releasedAt: "2026-01-01" },
  ],
};

describe("agent links", () => {
  it("uses explicit current version even if release files are ordered differently", () => {
    expect(resolveAgentRelease(released)?.version).toBe("1.0");
    expect(agentTargetFromSearch(agentPageHref(released.id, "0.9"), [released]).target).toEqual({ agentId: released.id, version: "0.9" });
    expect(agentTargetFromSearch(agentPageHref(released.id, "retired"), [released])).toMatchObject({ unavailableVersion: true, target: { version: "1.0" } });
  });
  it("supports listings without releases and handles missing links", () => {
    expect(resolveAgentRelease(listing)).toBeUndefined();
    expect(agentTargetFromSearch(agentPageHref(listing.id), [listing]).target).toEqual({ agentId: listing.id, version: undefined });
    expect(agentTargetFromSearch("?page=agents&agent=missing", [listing]).missingAgent).toBe(true);
    expect(agentTargetFromSearch("?page=agents&agent=anthropic-pdf&query=gitlab", [listing]).filters).toEqual(defaultAgentFilters);
  });
});
