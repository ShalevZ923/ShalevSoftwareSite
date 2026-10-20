import type { AgentPackage, AgentPackageType, RiskLevel } from "./agents";
import { recencyRank } from "./catalog";

export type AgentCatalogFilters = {
  query: string;
  packageType: string;
  publisher: string;
  risk: "All risks" | RiskLevel;
  sort: "name" | "type" | "updated";
};

export const defaultAgentFilters: AgentCatalogFilters = {
  query: "",
  packageType: "All types",
  publisher: "All publishers",
  risk: "All risks",
  sort: "name",
};

const risks: AgentCatalogFilters["risk"][] = ["All risks", "Low", "Medium", "High"];
const sorts: AgentCatalogFilters["sort"][] = ["name", "type", "updated"];

export function agentFiltersFromSearch(
  search: string,
  knownTypes: readonly string[],
  knownPublishers: readonly string[],
): AgentCatalogFilters {
  const params = new URLSearchParams(search);
  const valueOrDefault = <T extends string>(
    value: string | null,
    allowed: readonly T[],
    fallback: T,
  ) => (value !== null && allowed.includes(value as T) ? (value as T) : fallback);
  const packageType = params.get("type");
  const publisher = params.get("publisher");

  return {
    query: params.get("query") ?? defaultAgentFilters.query,
    packageType:
      packageType !== null && knownTypes.includes(packageType)
        ? packageType
        : defaultAgentFilters.packageType,
    publisher:
      publisher !== null && knownPublishers.includes(publisher)
        ? publisher
        : defaultAgentFilters.publisher,
    risk: valueOrDefault(params.get("risk"), risks, defaultAgentFilters.risk),
    sort: valueOrDefault(params.get("sort"), sorts, defaultAgentFilters.sort),
  };
}

export function agentFiltersToSearch(filters: AgentCatalogFilters) {
  const params = new URLSearchParams();
  const query = filters.query.trim();

  if (query) params.set("query", query);
  if (filters.packageType !== defaultAgentFilters.packageType) params.set("type", filters.packageType);
  if (filters.publisher !== defaultAgentFilters.publisher) params.set("publisher", filters.publisher);
  if (filters.risk !== defaultAgentFilters.risk) params.set("risk", filters.risk);
  if (filters.sort !== defaultAgentFilters.sort) params.set("sort", filters.sort);

  return params.toString();
}

export function getAgentCatalog(catalog: AgentPackage[], filters: AgentCatalogFilters) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase();
  const sourceOrder = new Map(catalog.map((agent, index) => [agent.id, index]));

  return [...catalog]
    .filter((agent) => {
      const haystack = [
        agent.name,
        agent.publisher,
        agent.packageType,
        agent.riskLevel,
        ...agent.tags,
        ...agent.permissions,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (filters.packageType === "All types" || agent.packageType === filters.packageType) &&
        (filters.publisher === "All publishers" || agent.publisher === filters.publisher) &&
        (filters.risk === "All risks" || agent.riskLevel === filters.risk)
      );
    })
    .sort((a, b) => {
      if (filters.sort === "type") {
        return a.packageType.localeCompare(b.packageType) || a.name.localeCompare(b.name);
      }
      if (filters.sort === "updated") return (sourceOrder.get(a.id) ?? 0) - (sourceOrder.get(b.id) ?? 0);
      return a.name.localeCompare(b.name);
    });
}

export function getRecentAgentUpdates(catalog: AgentPackage[]): AgentPackage[] {
  return [...catalog].sort((a, b) => {
    const byTime = recencyRank(a.updated) - recencyRank(b.updated);
    if (byTime !== 0) return byTime;
    return a.name.localeCompare(b.name);
  });
}

export const agentPackageTypes: AgentPackageType[] = [
  "Skill",
  "Agent Pack",
  "Role Pack",
  "MCP Server",
];
