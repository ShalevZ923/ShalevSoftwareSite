export type Page = "catalog" | "agents" | "documentation" | "updates" | "about" | "developer";

export function pageFromSearch(search: string): Page {
  const page = new URLSearchParams(search).get("page");
  return page === "catalog" ||
    page === "agents" ||
    page === "documentation" ||
    page === "updates" ||
    page === "about" ||
    page === "developer"
    ? page
    : "agents";
}
