import { section, selectedPlatforms, optionalFacts } from "./submission-fields.mjs";
import { parseReleaseList, slugifyId } from "./catalog-content.mjs";
export function parseCatalogSubmission({
  body,
  updatedAt,
  order,
  taxonomy,
  source = "submission",
}) {
  if (typeof body !== "string") throw new Error("Submission body is unavailable");
  const name = section(body, "Software name"),
    supportName = section(body, "Support owner"),
    categoryId = section(body, "Category ID");
  const category = taxonomy.find((item) => item.id === categoryId);
  if (!category)
    throw new Error("Category ID is not in content/taxonomy/categories.json: " + categoryId);
  const id = slugifyId(name);
  if (!id) throw new Error("Software name cannot produce a valid catalog id");
  return {
    categoryId,
    guide: section(body, "Installation and support guide"),
    metadata: {
      id,
      order,
      name,
      company: section(body, "Vendor or company"),
      category: category.label,
      platforms: selectedPlatforms(section(body, "Supported platforms")),
      lifecycle: section(body, "Lifecycle"),
      icon: section(body, "Catalog tile"),
      releases: parseReleaseList(section(body, "Approved releases"), source),
      updated: new Date(updatedAt).toISOString().slice(0, 10),
      description: section(body, "Short description"),
      support: {
        name: supportName,
        team: section(body, "Support team"),
        initials: supportName
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        email: section(body, "Support email"),
      },
      tags: section(body, "Tags")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      facts: optionalFacts(section(body, "Optional facts", false)),
    },
  };
}
