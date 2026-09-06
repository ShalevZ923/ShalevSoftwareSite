import type { Tool } from "./data";
import {
  catalogFiltersFromSearch,
  defaultFilters,
  getCatalogTools,
} from "./catalog";

export type CatalogTarget = { toolId: string; version?: string };

/** Links identify catalog records and releases, never arbitrary download URLs. */
export function toolPageHref(
  page: "catalog" | "documentation",
  toolId: string,
  version?: string,
) {
  const params = new URLSearchParams({ page, tool: toolId });
  if (version) params.set("version", version);
  return `?${params}`;
}

export function resolveToolRelease(tool: Tool, version?: string | null) {
  return (
    tool.releases.find((release) => release.version === version) ??
    tool.releases[0]
  );
}

export function catalogTargetFromSearch(search: string, tools: Tool[]) {
  const params = new URLSearchParams(search);
  const requestedTool = params.get("tool");
  const requestedVersion = params.get("version") || undefined;
  const tool = tools.find((item) => item.id === requestedTool);
  const release = tool ? resolveToolRelease(tool, requestedVersion) : undefined;
  const filters = catalogFiltersFromSearch(
    search,
    tools.map((item) => item.category),
  );
  return {
    filters:
      tool &&
      !getCatalogTools(tools, filters).some((item) => item.id === tool.id)
        ? defaultFilters
        : filters,
    target: tool
      ? {
          toolId: tool.id,
          version: requestedVersion ? release?.version : undefined,
        }
      : null,
    missingTool: !!requestedTool && !tool,
    unavailableVersion:
      !!tool && !!requestedVersion && requestedVersion !== release?.version,
    defaultVersion: tool?.releases[0].version,
  };
}
