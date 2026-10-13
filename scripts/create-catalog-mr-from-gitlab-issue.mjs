import { parseCatalogSubmission } from "./catalog-submission.mjs";
import { renderMachineCatalog } from "./catalog-content.mjs";
import { section, selectedPlatforms, optionalFacts } from "./submission-fields.mjs";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  loadCatalogEntries,
  loadTaxonomy,
  parseReleaseList,
  renderCatalogEntryFiles,
  renderGeneratedCatalog,
  repositoryRoot,
  slugifyId,
} from "./catalog-content.mjs";
import { relative } from "node:path";
import {
  descriptionSha256,
  requireApprovedDescription,
  trustedGitLabApiBase,
} from "./gitlab-catalog-security.mjs";

const execFileAsync = promisify(execFile);

async function readStandardInput() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

const taxonomy = await loadTaxonomy();

function parseEntry(issue, order) {
  return parseCatalogSubmission({
    body: issue.description,
    updatedAt: issue.updated_at ?? new Date().toISOString(),
    order,
    taxonomy,
    source: `GitLab issue #${issue.iid}`,
  });
}

async function entryFiles(entry) {
  const files = renderCatalogEntryFiles(entry.metadata, entry.guide, entry.categoryId).files;
  const vendorFile = files[0];
  try {
    const currentVendor = await readFile(vendorFile.path, "utf8");
    if (currentVendor !== vendorFile.content)
      throw new Error(
        `Vendor directory already belongs to a different company: ${vendorFile.path}`,
      );
    files.shift();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return files.map((file) => ({ ...file, path: relative(repositoryRoot, file.path) }));
}

if (process.argv.includes("--description-sha256")) {
  const issue = JSON.parse(await readStandardInput());
  process.stdout.write(`${descriptionSha256(issue.description)}\n`);
  process.exit(0);
}

if (process.argv.includes("--dry-run")) {
  const issuePath = process.env.GITLAB_ISSUE_JSON;
  if (!issuePath) throw new Error("GITLAB_ISSUE_JSON is required for a dry run");
  const issue = JSON.parse(await readFile(issuePath, "utf8"));
  const existingEntries = await loadCatalogEntries();
  const entry = parseEntry(
    issue,
    Math.max(...existingEntries.map(({ metadata }) => metadata.order)) + 1,
  );
  if (existingEntries.some(({ metadata }) => metadata.id === entry.metadata.id))
    throw new Error(`Catalog entry already exists: ${entry.metadata.id}`);
  await entryFiles(entry);
  renderGeneratedCatalog(
    [...existingEntries, entry].sort((left, right) => left.metadata.order - right.metadata.order),
  );
  process.stdout.write(
    `Validated catalog entry ${entry.metadata.id} from GitLab issue #${issue.iid}.\n`,
  );
  process.exit(0);
}

const requiredEnvironment = [
  "CI_API_V4_URL",
  "CI_PROJECT_ID",
  "CATALOG_ISSUE_IID",
  "CATALOG_APPROVED_DESCRIPTION_SHA256",
  "GITLAB_CATALOG_MR_TOKEN",
];
for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const { stdout: repositoryRemote } = await execFileAsync("git", ["remote", "get-url", "origin"]);
const trustedApiBase = trustedGitLabApiBase(process.env.CI_API_V4_URL, repositoryRemote.trim());
const apiBase = `${trustedApiBase}/projects/${encodeURIComponent(process.env.CI_PROJECT_ID)}`;
const headers = {
  "PRIVATE-TOKEN": process.env.GITLAB_CATALOG_MR_TOKEN,
  "Content-Type": "application/json",
};

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!response.ok) throw new Error(`GitLab API request failed (${response.status}) for ${path}`);
  return response.status === 204 ? undefined : response.json();
}

const issue = await api(`/issues/${encodeURIComponent(process.env.CATALOG_ISSUE_IID)}`);
if (!issue.labels?.includes("catalog-approved"))
  throw new Error("Issue must have the catalog-approved label");
if (issue.state !== "opened") throw new Error("Issue must be open");
requireApprovedDescription(issue.description, process.env.CATALOG_APPROVED_DESCRIPTION_SHA256);

const existingEntries = await loadCatalogEntries();
const entry = parseEntry(
  issue,
  Math.max(...existingEntries.map(({ metadata }) => metadata.order)) + 1,
);
if (existingEntries.some(({ metadata }) => metadata.id === entry.metadata.id)) {
  throw new Error(`Catalog entry already exists: ${entry.metadata.id}`);
}
const acceptedEntries = [...existingEntries, entry].sort(
  (left, right) => left.metadata.order - right.metadata.order,
);
const feed = renderMachineCatalog(acceptedEntries);
const generated = renderGeneratedCatalog(
  [...existingEntries, entry].sort((left, right) => left.metadata.order - right.metadata.order),
);
const acceptedFiles = await entryFiles(entry);
const branch = `catalog/issue-${issue.iid}`;
const branchResponse = await fetch(`${apiBase}/repository/branches/${encodeURIComponent(branch)}`, {
  headers,
});
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

await api("/repository/commits", {
  method: "POST",
  body: JSON.stringify({
    branch,
    commit_message: `content: add catalog entry from issue #${issue.iid}`,
    actions: [
      ...acceptedFiles.map((file) => ({
        action: "create",
        file_path: file.path,
        content: file.content,
      })),
      { action: "update", file_path: "src/generated/catalog.ts", content: generated },
      { action: "update", file_path: "public/catalog/v1/index.json", content: feed.index },
      { action: "update", file_path: "public/catalog/v1/tools.json", content: feed.tools },
    ],
  }),
});
const mergeRequest = await api("/merge_requests", {
  method: "POST",
  body: JSON.stringify({
    source_branch: branch,
    target_branch: targetBranch,
    title: `Catalog entry from issue #${issue.iid}`,
    description: `Created from approved catalog submission #${issue.iid}. Review the generated content, approved release target, and guide before merging.`,
  }),
});
process.stdout.write(`Created ${mergeRequest.web_url}.\n`);
