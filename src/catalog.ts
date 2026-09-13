import type { Lifecycle, Platform, Tool } from "./data";

export type CatalogFilters = {
  query: string;
  category: string;
  platform: "All platforms" | Platform;
  lifecycle: "All lifecycles" | Lifecycle;
  sort: "name" | "category" | "updated";
};

export const defaultFilters: CatalogFilters = {
  query: "",
  category: "All categories",
  platform: "All platforms",
  lifecycle: "All lifecycles",
  sort: "name",
};

const platforms: CatalogFilters["platform"][] = [
  "All platforms",
  "Windows",
  "Linux",
  "macOS",
  "Web",
];
const lifecycles: CatalogFilters["lifecycle"][] = [
  "All lifecycles",
  "Current",
  "New",
  "Legacy",
];
const sorts: CatalogFilters["sort"][] = ["name", "category", "updated"];

/** Restores a shareable catalog view without accepting unknown filter values. */
export function catalogFiltersFromSearch(
  search: string,
  knownCategories: readonly string[],
): CatalogFilters {
  const params = new URLSearchParams(search);
  const valueOrDefault = <T extends string>(
    value: string | null,
    allowed: readonly T[],
    fallback: T,
  ) =>
    value !== null && allowed.includes(value as T) ? (value as T) : fallback;
  const category = params.get("category");

  return {
    query: params.get("query") ?? defaultFilters.query,
    category:
      category !== null && knownCategories.includes(category)
        ? category
        : defaultFilters.category,
    platform: valueOrDefault(
      params.get("platform"),
      platforms,
      defaultFilters.platform,
    ),
    lifecycle: valueOrDefault(
      params.get("lifecycle"),
      lifecycles,
      defaultFilters.lifecycle,
    ),
    sort: valueOrDefault(params.get("sort"), sorts, defaultFilters.sort),
  };
}

/** Creates a compact, canonical query string that only contains active filters. */
export function catalogFiltersToSearch(filters: CatalogFilters) {
  const params = new URLSearchParams();
  const query = filters.query.trim();

  if (query) params.set("query", query);
  if (filters.category !== defaultFilters.category)
    params.set("category", filters.category);
  if (filters.platform !== defaultFilters.platform)
    params.set("platform", filters.platform);
  if (filters.lifecycle !== defaultFilters.lifecycle)
    params.set("lifecycle", filters.lifecycle);
  if (filters.sort !== defaultFilters.sort) params.set("sort", filters.sort);

  return params.toString();
}

export function getCatalogTools(catalog: Tool[], filters: CatalogFilters) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase();
  const sourceOrder = new Map(catalog.map((tool, index) => [tool.id, index]));

  return [...catalog]
    .filter((tool) => {
      const haystack = [
        tool.name,
        tool.company,
        tool.category,
        ...tool.tags,
        ...tool.platforms,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (filters.category === "All categories" ||
          tool.category === filters.category) &&
        (filters.platform === "All platforms" ||
          tool.platforms.includes(filters.platform)) &&
        (filters.lifecycle === "All lifecycles" ||
          tool.lifecycle === filters.lifecycle)
      );
    })
    .sort((a, b) => {
      if (filters.sort === "category")
        return (
          a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
        );
      if (filters.sort === "updated")
        return (sourceOrder.get(a.id) ?? 0) - (sourceOrder.get(b.id) ?? 0);
      return a.name.localeCompare(b.name);
    });
}

const monthIndex: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Smaller ranks are more recent. Relative labels outrank month-day stamps. */
export function recencyRank(updated: string): number {
  const value = updated.trim().toLocaleLowerCase();
  if (value === "today") return 0;
  if (value === "yesterday") return 1;
  const days = /^(\d+)\s+days?\s+ago$/u.exec(value);
  if (days) return Number(days[1]);
  const dated = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})$/u.exec(value);
  if (dated) {
    const month = monthIndex[dated[1]];
    const day = Number(dated[2]);
    return 200 + (11 - month) * 32 + (31 - day);
  }
  return 900;
}

export type CatalogUpdateKind = "notice" | "new" | "release" | "update";

export function catalogUpdateKind(tool: Tool): CatalogUpdateKind {
  if (tool.notice) return "notice";
  if (tool.lifecycle === "New") return "new";
  if (tool.releases.length > 1) return "release";
  return "update";
}

export const catalogUpdateKindLabel: Record<CatalogUpdateKind, string> = {
  notice: "Notice",
  new: "New in catalog",
  release: "Release",
  update: "Catalog change",
};

/** Newest catalog changes first, then name. */
export function getRecentUpdates(catalog: Tool[]): Tool[] {
  return [...catalog].sort((a, b) => {
    const byTime = recencyRank(a.updated) - recencyRank(b.updated);
    if (byTime !== 0) return byTime;
    return a.name.localeCompare(b.name);
  });
}

/** Returns a predictable, searchable list for the documentation library. */
export function getDocumentationTools(catalog: Tool[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return [...catalog]
    .filter((tool) => {
      if (!normalizedQuery) return true;

      return [
        tool.name,
        tool.company,
        tool.category,
        tool.support.name,
        tool.support.team,
        ...tool.tags,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function slugifyHeading(value: string) {
  return value
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
