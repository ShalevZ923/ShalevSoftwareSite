export type Page = "catalog" | "documentation" | "updates" | "about" | "developer";

const hideablePages = new Set<Page>(["documentation", "updates", "about", "developer"]);

export function parseHiddenPages(
  raw: string | undefined = import.meta.env.VITE_HIDDEN_PAGES,
): Set<Page> {
  if (!raw) return new Set();
  const hidden = new Set<Page>();
  for (const token of raw.split(",")) {
    const normalized = token.trim().toLowerCase() as Page;
    if (hideablePages.has(normalized)) {
      hidden.add(normalized);
    }
  }
  return hidden;
}

export function isPageVisible(
  page: Page,
  hiddenPages: ReadonlySet<Page> = parseHiddenPages(),
): boolean {
  if (page === "catalog") return true;
  return !hiddenPages.has(page);
}

export function pageFromSearch(
  search: string,
  hiddenPages: ReadonlySet<Page> = parseHiddenPages(),
): Page {
  const page = new URLSearchParams(search).get("page");
  const candidate: Page =
    page === "documentation" || page === "updates" || page === "about" || page === "developer"
      ? page
      : "catalog";
  return isPageVisible(candidate, hiddenPages) ? candidate : "catalog";
}
