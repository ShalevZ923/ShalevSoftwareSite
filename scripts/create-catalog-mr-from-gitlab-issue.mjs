import { readFile } from "node:fs/promises";
import { loadCatalogEntries, renderCatalogFile, renderGeneratedCatalog, slugifyId } from "./catalog-content.mjs";

function section(body, label, required = true) {
  const heading = `### ${label}`;
  const start = body.indexOf(heading);
  if (start < 0) {
    if (required) throw new Error(`Issue template is missing: ${label}`);
    return "";
  }
  const afterHeading = body.slice(start + heading.length).replace(/^\r?\n/, "");
  const nextHeading = afterHeading.search(/^### /mu);
  const value = (nextHeading < 0 ? afterHeading : afterHeading.slice(0, nextHeading))
    .replace(/<!--[\s\S]*?-->/gu, "")
    .trim();
  if (value === "_No response_" || !value) {
    if (required) throw new Error(`Issue template is missing: ${label}`);
    return "";
  }
  return value;
}

function selectedPlatforms(value) {
  return ["Windows", "Linux", "macOS", "Web"].filter((platform) => new RegExp(`- \\[x\\] ${platform}`, "iu").test(value));
}

function optionalFacts(value) {
  if (!value.trim()) return undefined;
  return value.split("\n").filter(Boolean).map((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error("Optional facts must use one Label: value pair per line");
    return { label: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
  });
}

function parseEntry(issue, order) {
  const body = issue.description;
  if (typeof body !== "string") throw new Error("Issue description is unavailable");
  const name = section(body, "Software name");
  const supportName = section(body, "Support owner");
  const id = slugifyId(name);
  if (!id) throw new Error("Software name cannot produce a valid catalog id");
  return {
    metadata: {
      id,
      order,
      name,
      company: section(body, "Vendor or company"),
      category: section(body, "Category"),
      platforms: selectedPlatforms(section(body, "Supported platforms")),
      lifecycle: section(body, "Lifecycle"),
      icon: section(body, "Catalog tile"),
      version: section(body, "Approved version"),
      updated: new Date(issue.updated_at ?? Date.now()).toISOString().slice(0, 10),
      description: section(body, "Short description"),
      support: {
        name: supportName,
        team: section(body, "Support team"),
        initials: supportName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
        email: section(body, "Support email"),
      },
      download: section(body, "Approved download URL"),
      tags: section(body, "Tags").split(",").map((item) => item.trim()).filter(Boolean),
      facts: optionalFacts(section(body, "Optional facts", false)),
    },
    guide: section(body, "Installation and support guide"),
  };
}

if (process.argv.includes("--dry-run")) {
  const issuePath = process.env.GITLAB_ISSUE_JSON;
  if (!issuePath) throw new Error("GITLAB_ISSUE_JSON is required for a dry run");
  const issue = JSON.parse(await readFile(issuePath, "utf8"));
  const existingEntries = await loadCatalogEntries();
  const entry = parseEntry(issue, Math.max(...existingEntries.map(({ metadata }) => metadata.order)) + 1);
  renderCatalogFile(entry.metadata, entry.guide);
  renderGeneratedCatalog([...existingEntries, entry].sort((left, right) => left.metadata.order - right.metadata.order));
  process.stdout.write(`Validated catalog entry ${entry.metadata.id} from GitLab issue #${issue.iid}.\n`);
  process.exit(0);
}

const requiredEnvironment = ["CI_API_V4_URL", "CI_PROJECT_ID", "CATALOG_ISSUE_IID", "GITLAB_CATALOG_MR_TOKEN"];
for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const apiBase = `${process.env.CI_API_V4_URL}/projects/${encodeURIComponent(process.env.CI_PROJECT_ID)}`;
const headers = {
  "PRIVATE-TOKEN": process.env.GITLAB_CATALOG_MR_TOKEN,
  "Content-Type": "application/json",
};

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`GitLab API request failed (${response.status}) for ${path}`);
  return response.status === 204 ? undefined : response.json();
}

const issue = await api(`/issues/${encodeURIComponent(process.env.CATALOG_ISSUE_IID)}`);
if (!issue.labels?.includes("catalog-approved")) throw new Error("Issue must have the catalog-approved label");
if (issue.state !== "opened") throw new Error("Issue must be open");

const existingEntries = await loadCatalogEntries();
const entry = parseEntry(issue, Math.max(...existingEntries.map(({ metadata }) => metadata.order)) + 1);
if (existingEntries.some(({ metadata }) => metadata.id === entry.metadata.id)) {
  throw new Error(`Catalog entry already exists: ${entry.metadata.id}`);
}
const branch = `catalog/issue-${issue.iid}`;
const branchResponse = await fetch(`${apiBase}/repository/branches/${encodeURIComponent(branch)}`, { headers });
if (branchResponse.status !== 404) {
  if (branchResponse.ok) throw new Error(`Catalog branch already exists for issue #${issue.iid}`);
  throw new Error(`GitLab API request failed (${branchResponse.status}) while checking branch`);
}

const targetBranch = process.env.CI_DEFAULT_BRANCH;
if (!targetBranch) throw new Error("CI_DEFAULT_BRANCH is required");
await api("/repository/branches", {
  method: "POST",
  body: JSON.stringify({ branch, ref: targetBranch }),
});

const generated = renderGeneratedCatalog([...existingEntries, entry].sort((left, right) => left.metadata.order - right.metadata.order));
await api("/repository/commits", {
  method: "POST",
  body: JSON.stringify({
    branch,
    commit_message: `content: add catalog entry from issue #${issue.iid}`,
    actions: [
      { action: "create", file_path: `content/tools/${entry.metadata.id}.md`, content: renderCatalogFile(entry.metadata, entry.guide) },
      { action: "update", file_path: "src/generated/catalog.ts", content: generated },
    ],
  }),
});
const mergeRequest = await api("/merge_requests", {
  method: "POST",
  body: JSON.stringify({
    source_branch: branch,
    target_branch: targetBranch,
    title: `Catalog entry from issue #${issue.iid}`,
    description: `Created from approved catalog submission #${issue.iid}. Review the generated content, trusted download URL, and guide before merging.`,
  }),
});
process.stdout.write(`Created ${mergeRequest.web_url}.\n`);
