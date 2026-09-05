import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { loadTaxonomy, nextCatalogOrder, parseReleaseList, renderCatalogEntryFiles, slugifyId, writeGeneratedCatalog } from "./catalog-content.mjs";

function section(body, label, required = true) {
  const heading = `### ${label}`;
  const start = body.indexOf(heading);
  if (start < 0) { if (required) throw new Error(`Issue form is missing: ${label}`); return ""; }
  const afterHeading = body.slice(start + heading.length).replace(/^\r?\n/, "");
  const nextHeading = afterHeading.search(/^### /mu);
  const value = (nextHeading < 0 ? afterHeading : afterHeading.slice(0, nextHeading)).trim();
  if (value === "_No response_" || !value) { if (required) throw new Error(`Issue form is missing: ${label}`); return ""; }
  return value;
}
function commaSeparated(value) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function selectedPlatforms(value) { return ["Windows", "Linux", "macOS", "Web"].filter((platform) => new RegExp(`- \\[x\\] ${platform}`, "iu").test(value)); }
function optionalFacts(value) {
  if (!value.trim()) return undefined;
  return value.split("\n").filter(Boolean).map((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error("Optional facts must use one Label: value pair per line");
    return { label: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
  });
}

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required when creating an entry from an issue");
const event = JSON.parse(await readFile(eventPath, "utf8"));
const body = event.issue?.body;
if (typeof body !== "string") throw new Error("Issue body is unavailable");
const taxonomy = await loadTaxonomy();
const categoryId = section(body, "Category ID");
const category = taxonomy.find(({ id }) => id === categoryId);
if (!category) throw new Error(`Category ID is not in content/taxonomy/categories.json: ${categoryId}`);
const name = section(body, "Software name");
const supportName = section(body, "Support owner");
const id = slugifyId(name);
if (!id) throw new Error("Software name cannot produce a valid catalog id");
const metadata = {
  id, order: await nextCatalogOrder(), name, company: section(body, "Vendor or company"), category: category.label,
  platforms: selectedPlatforms(section(body, "Supported platforms")), lifecycle: section(body, "Lifecycle"), icon: section(body, "Catalog tile"),
  releases: parseReleaseList(section(body, "Approved releases"), `issue #${event.issue.number}`), updated: new Date(event.issue.updated_at ?? Date.now()).toISOString().slice(0, 10),
  description: section(body, "Short description"),
  support: { name: supportName, team: section(body, "Support team"), initials: supportName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), email: section(body, "Support email") },
  tags: commaSeparated(section(body, "Tags")), facts: optionalFacts(section(body, "Optional facts", false)),
};
const guide = section(body, "Installation and support guide");
const { directory, files } = renderCatalogEntryFiles(metadata, guide, categoryId);
try { await access(directory, constants.F_OK); throw new Error(`Catalog entry already exists: ${id}`); }
catch (error) { if (error.code !== "ENOENT") throw error; }
try {
  const existingVendor = JSON.parse(await readFile(files[0].path, "utf8"));
  if (existingVendor.name !== metadata.company) throw new Error(`Vendor directory already belongs to ${existingVendor.name}`);
} catch (error) { if (error.code !== "ENOENT") throw error; }
for (const file of files) { await mkdir(dirname(file.path), { recursive: true }); await writeFile(file.path, file.content, "utf8"); }
await writeGeneratedCatalog();
process.stdout.write(`Created catalog entry ${id} from issue #${event.issue.number}.\n`);
