import type { AgentPackage } from "./agents";
import {
  agentFiltersFromSearch,
  defaultAgentFilters,
  getAgentCatalog,
} from "./agentCatalog";

export type AgentCatalogTarget = { agentId: string; version?: string };

export function agentPageHref(agentId: string, version?: string) {
  const params = new URLSearchParams({ page: "agents", agent: agentId });
  if (version) params.set("version", version);
  return `?${params}`;
}

export function resolveAgentRelease(agent: AgentPackage, version?: string | null) {
  return agent.releases.find((release) => release.version === version) ?? agent.releases[0];
}

export function agentTargetFromSearch(search: string, catalog: AgentPackage[]) {
  const params = new URLSearchParams(search);
  const requestedAgent = params.get("agent");
  const requestedVersion = params.get("version") || undefined;
  const agent = catalog.find((item) => item.id === requestedAgent);
  const release = agent ? resolveAgentRelease(agent, requestedVersion) : undefined;
  const filters = agentFiltersFromSearch(
    search,
    catalog.map((item) => item.packageType),
    catalog.map((item) => item.publisher),
  );
  return {
    filters:
      agent && !getAgentCatalog(catalog, filters).some((item) => item.id === agent.id)
        ? defaultAgentFilters
        : filters,
    target: agent
      ? {
          agentId: agent.id,
          version: requestedVersion ? release?.version : undefined,
        }
      : null,
    missingAgent: !!requestedAgent && !agent,
    unavailableVersion:
      !!agent && !!requestedVersion && requestedVersion !== release?.version,
    defaultVersion: agent?.releases[0].version,
  };
}
