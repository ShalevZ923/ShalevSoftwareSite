import type { AgentPackage, AgentPackageType, RiskLevel, SupportStatus } from "./agentTypes";
import facets from "../content/taxonomy/agent-facets.json";

export const agentFacets = facets;
export const supportLabels: Record<SupportStatus, string> = {
  supported: "Supported", evaluation: "In evaluation", deprecated: "Deprecated", example: "Example",
};
export const agentPackageTypes: AgentPackageType[] = ["MCP Server", "Skill", "Agent Pack", "Role Pack"];
export const agentPageSize = 20;
export type AgentCatalogFilters = {
  query: string;
  packageType: string;
  publisher: string;
  risk: "All risks" | RiskLevel;
  status: "all" | SupportStatus;
  capability: string;
  sort: "name" | "type" | "updated";
};
export const defaultAgentFilters: AgentCatalogFilters = {
  query: "", packageType: "All types", publisher: "All publishers", risk: "All risks",
  status: "all", capability: "all", sort: "name",
};
const risks: AgentCatalogFilters["risk"][] = ["All risks", "Low", "Medium", "High", "Unknown"];
const sorts: AgentCatalogFilters["sort"][] = ["name", "type", "updated"];
export function agentFiltersFromSearch(search: string, knownTypes: readonly string[], knownPublishers: readonly string[]): AgentCatalogFilters {
  const params = new URLSearchParams(search);
  const allowed = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const value = params.get(key);
    return value !== null && values.includes(value as T) ? value as T : fallback;
  };
  return {
    query: (params.get("query") ?? "").slice(0, 200),
    packageType: allowed("type", knownTypes, "All types"),
    publisher: allowed("publisher", knownPublishers, "All publishers"),
    risk: allowed("risk", risks, "All risks"),
    status: allowed("status", ["all", "supported", "evaluation", "deprecated", "example"], "all"),
    capability: allowed("capability", facets.capabilities.map((item) => item.id), "all"),
    sort: allowed("sort", sorts, "name"),
  };
}
export function agentFiltersToSearch(filters: AgentCatalogFilters) {
  const params = new URLSearchParams();
  const keys: [keyof AgentCatalogFilters, string][] = [
    ["query", "query"], ["packageType", "type"], ["publisher", "publisher"], ["risk", "risk"],
    ["status", "status"], ["capability", "capability"], ["sort", "sort"],
  ];
  for (const [key, param] of keys) {
    const value = key === "query" ? filters[key].trim() : filters[key];
    if (value !== defaultAgentFilters[key]) params.set(param, value);
  }
  return params.toString();
}
export function facetLabel(id: string) {
  return facets.capabilities.find((item) => item.id === id)?.label ?? id;
}
const normalize = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
// Cache by immutable record identity. Description and capability search do not rebuild on each keystroke.
const searchIndex = new WeakMap<AgentPackage, string>();
function searchableText(agent: AgentPackage) {
  let value = searchIndex.get(agent);
  if (value === undefined) {
    value = normalize([
      agent.id, agent.name, agent.description, agent.publisher, agent.packageType, agent.riskLevel,
      supportLabels[agent.status], agent.maintainer.name, agent.maintainer.team,
      ...agent.tags, ...agent.highlights, ...agent.permissions, ...agent.requirements,
      ...agent.capabilities.map(facetLabel),
      ...(agent.mcp ? [...agent.mcp.tools.flatMap((tool) => [tool.name, tool.description, tool.effect]), ...agent.mcp.resources, ...agent.mcp.prompts, agent.mcp.transport] : []),
    ].join(" "));
    searchIndex.set(agent, value);
  }
  return value;
}
export function getAgentCatalog(catalog: AgentPackage[], filters: AgentCatalogFilters) {
  const terms = normalize(filters.query.trim()).split(/\s+/).filter(Boolean);
  return catalog.filter((agent) =>
    terms.every((term) => searchableText(agent).includes(term)) &&
    (filters.packageType === "All types" || agent.packageType === filters.packageType) &&
    (filters.publisher === "All publishers" || agent.publisher === filters.publisher) &&
    (filters.risk === "All risks" || agent.riskLevel === filters.risk) &&
    (filters.status === "all" || agent.status === filters.status) &&
    (filters.capability === "all" || agent.capabilities.includes(filters.capability))
  ).sort((a, b) => {
    if (filters.sort === "updated") return b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    if (filters.sort === "type") return agentPackageTypes.indexOf(a.packageType) - agentPackageTypes.indexOf(b.packageType) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
export function getRecentAgentUpdates(catalog: AgentPackage[]) {
  return getAgentCatalog(catalog, { ...defaultAgentFilters, sort: "updated" });
}
export function agentPageFromSearch(search: string) {
  const value = new URLSearchParams(search).get("p") ?? "1";
  const page = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(page) && page > 0 ? page : 1;
}
export function paginateAgents(catalog: AgentPackage[], requestedPage: number, targetId?: string) {
  const count = Math.max(1, Math.ceil(catalog.length / agentPageSize));
  const targetIndex = targetId ? catalog.findIndex((agent) => agent.id === targetId) : -1;
  const page = targetIndex >= 0 ? Math.floor(targetIndex / agentPageSize) + 1 : Math.max(1, Math.min(count, requestedPage));
  return { page, pageCount: count, items: catalog.slice((page - 1) * agentPageSize, page * agentPageSize) };
}
export function formatAgentDate(date: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
