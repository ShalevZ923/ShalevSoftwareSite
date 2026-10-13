import { saveCatalogEntry } from "./catalog-persistence.mjs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  loadTaxonomy,
  nextCatalogOrder,
  parseReleaseList,
  renderCatalogEntryFiles,
  slugifyId,
  writeGeneratedCatalog,
} from "./catalog-content.mjs";

const prompt = createInterface({ input, output });
async function ask(label, fallback = "") {
  const answer = (await prompt.question(`${label}${fallback ? ` [${fallback}]` : ""}: `)).trim();
  return answer || fallback;
}

try {
  const name = await ask("Software name");
  const id = slugifyId(await ask("ID", slugifyId(name)));
  const company = await ask("Vendor/company");
  const taxonomy = await loadTaxonomy();
  const categoryId = await ask("Category ID");
  const category = taxonomy.find(({ id: knownId }) => knownId === categoryId);
  if (!category)
    throw new Error(`Category ID is not in content/taxonomy/categories.json: ${categoryId}`);
  const platforms = (await ask("Platforms (comma-separated: Windows, Linux, macOS, Web)"))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const lifecycle = await ask("Lifecycle (Current, New, or Legacy)", "Current");
  const releases = parseReleaseList(
    await ask(
      "Approved releases (version | HTTPS URL or artifact:tool-id/version/filename; separate with ; )",
    ),
    "interactive input",
  );
  const description = await ask("Short description");
  const supportName = await ask("Support owner name");
  const supportTeam = await ask("Support team");
  const supportEmail = await ask("Support email");
  const tags = (await ask("Tags (comma-separated)"))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const metadata = {
    id,
    order: await nextCatalogOrder(),
    name,
    company,
    category: category.label,
    platforms,
    lifecycle,
    icon:
      name
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(0, 2)
        .toUpperCase() || "SW",
    releases,
    updated: new Date().toISOString().slice(0, 10),
    description,
    support: {
      name: supportName,
      team: supportTeam,
      initials: supportName
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      email: supportEmail,
    },
    tags,
  };
  const guide = `# ${name}\n\n${description}\n\n## Install\n\nAdd the approved installation steps before merging.\n\n## Support\n\nContact ${supportName} at ${supportEmail} for support.`;
  await saveCatalogEntry(metadata, guide, { create: true });
  process.stdout.write(`Created ${id}. Review the guide, then run npm run verify.\n`);
} finally {
  prompt.close();
}
