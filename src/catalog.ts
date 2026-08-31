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
