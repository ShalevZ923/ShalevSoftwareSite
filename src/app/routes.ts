export type Page = "catalog" | "documentation" | "updates" | "about" | "developer";

export function pageFromSearch(search: string): Page {
  const page = new URLSearchParams(search).get("page");
  return page === "documentation" || page === "updates" || page === "about" || page === "developer"
    ? page
    : "catalog";
}
