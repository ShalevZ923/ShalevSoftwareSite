import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const contentDirectory = join(repositoryRoot, "content", "catalog");
export const taxonomyPath = join(repositoryRoot, "content", "taxonomy", "categories.json");
export const generatedCatalogPath = join(repositoryRoot, "src", "generated", "catalog.ts");

const platforms = new Set(["Windows", "Linux", "macOS", "Web"]);
const lifecycles = new Set(["Current", "New", "Legacy"]);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const localImagePattern = /^\/tool-images\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const artifactPointerPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const sensitiveFactPattern = /key|activation|password|token/i;
const noticeTones = new Set(["info", "warning"]);
const guideKinds = new Set(["official-manual", "internal-guide", "training"]);
const guideFormats = new Set(["pdf", "pptx", "web"]);
const guideFilePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:pdf|pptx)$/;

function fail(source, message) {
  throw new Error(`${source}: ${message}`);
}

function requiredString(value, field, source) {
  if (typeof value !== "string" || !value.trim()) fail(source, `${field} must be a non-empty string`);
  return value.trim();
}

function requireStringList(value, field, source) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) {
    fail(source, `${field} must be a non-empty list of strings`);
  }
  return value.map((item) => item.trim());
}

function requiredHttpsUrl(value, field, source) {
  const download = requiredString(value, field, source);
  try {
    const url = new URL(download);
    if (url.protocol !== "https:" || url.username || url.password) fail(source, `${field} must be a credential-free HTTPS URL`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${source}:`)) throw error;
    fail(source, `${field} must be a valid HTTPS URL`);
  }
  return download;
}

function requiredArtifactPointer(value, field, source) {
  const artifact = requiredString(value, field, source);
  if (!artifactPointerPattern.test(artifact)) {
    fail(source, `${field} must use tool-id/version/filename with safe path characters`);
  }
  return artifact;
}

function requiredVersion(value, source) {
  const version = requiredString(value, "releases.version", source);
  if (!versionPattern.test(version)) fail(source, "releases.version must be filename-safe");
  return version;
}

export function parseReleaseList(value, source) {
  const releases = value
    .split(/\r?\n|;/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("|");
      if (separator < 1) {
        fail(source, "each approved release must use: version | HTTPS URL or artifact:tool-id/version/filename");
      }
      const version = requiredVersion(line.slice(0, separator), source);
      const target = requiredString(line.slice(separator + 1), "releases.target", source);
      if (target.startsWith("artifact:")) {
        return {
          version,
          artifact: requiredArtifactPointer(target.slice("artifact:".length), "releases.artifact", source),
        };
      }
      return {
        version,
        download: requiredHttpsUrl(target, "releases.download", source),
      };
    });
  if (releases.length === 0) fail(source, "releases must contain at least one approved release");
  if (new Set(releases.map((release) => release.version)).size !== releases.length) fail(source, "releases must not repeat a version");
  return releases;
}

export function slugifyId(value) {
  return value.toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function readJson(path, source = path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail(source, `must contain valid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
}

async function findFiles(directory, filename) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findFiles(path, filename);
    return entry.isFile() && entry.name === filename ? [path] : [];
  }));
  return nested.flat();
}

export async function loadTaxonomy() {
  const taxonomy = await readJson(taxonomyPath);
  if (!taxonomy || typeof taxonomy !== "object" || Array.isArray(taxonomy) || !Array.isArray(taxonomy.categories)) fail(taxonomyPath, "must contain a categories list");
  const categories = taxonomy.categories.map((category, index) => {
    const source = `${taxonomyPath} category ${index + 1}`;
    if (!category || typeof category !== "object" || Array.isArray(category)) fail(source, "must be an object");
    const id = requiredString(category.id, "id", source);
    if (!id.split("/").every((segment) => idPattern.test(segment))) fail(source, "id must use lowercase kebab-case path segments");
    return { id, label: requiredString(category.label, "label", source), description: requiredString(category.description, "description", source) };
  });
  if (categories.length === 0) fail(taxonomyPath, "must contain at least one category");
  if (new Set(categories.map((category) => category.id)).size !== categories.length) fail(taxonomyPath, "must not repeat category ids");
  return categories.sort((left, right) => right.id.length - left.id.length);
}

function findCategoryForPath(pathSegments, categories, source) {
  const category = categories.find(({ id }) => id.split("/").every((segment, index) => pathSegments[index] === segment));
  if (!category) fail(source, "must be located beneath a category defined in content/taxonomy/categories.json");
  return category;
}

export function validateCatalogEntry(source, metadata, guide) {
  const id = requiredString(metadata.id, "id", source);
  if (!idPattern.test(id)) fail(source, "id must be lowercase kebab-case");
  if (!Number.isSafeInteger(metadata.order) || metadata.order < 1) fail(source, "order must be a positive integer");
  for (const field of ["name", "company", "category", "description", "updated", "icon"]) requiredString(metadata[field], field, source);
  const entryPlatforms = requireStringList(metadata.platforms, "platforms", source);
  if (entryPlatforms.some((platform) => !platforms.has(platform))) fail(source, "platforms contains an unsupported value");
  if (!lifecycles.has(metadata.lifecycle)) fail(source, "lifecycle must be Current, New, or Legacy");
  if (!metadata.support || typeof metadata.support !== "object" || Array.isArray(metadata.support)) fail(source, "support must be an object");
  for (const field of ["name", "team", "initials", "email"]) requiredString(metadata.support[field], `support.${field}`, source);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(metadata.support.email)) fail(source, "support.email must be an email address");
  if (!Array.isArray(metadata.releases)) fail(source, "releases must be a list");
  const releaseVersions = new Set();
  for (const release of metadata.releases) {
    if (!release || typeof release !== "object" || Array.isArray(release)) fail(source, "each release must be an object");
    const version = requiredVersion(release.version, source);
    if (releaseVersions.has(version)) fail(source, "releases must not repeat a version");
    releaseVersions.add(version);
    const hasDownload = release.download !== undefined;
    const hasArtifact = release.artifact !== undefined;
    if (hasDownload === hasArtifact) {
      fail(source, "each release must define exactly one download or artifact target");
    }
    if (hasDownload) {
      requiredHttpsUrl(release.download, "releases.download", source);
    } else {
      const artifact = requiredArtifactPointer(release.artifact, "releases.artifact", source);
      const [artifactToolId, artifactVersion] = artifact.split("/");
      if (artifactToolId !== id) fail(source, "releases.artifact tool-id must match the catalog id");
      if (artifactVersion !== version) fail(source, "releases.artifact version must match the release version");
    }
  }
  if (releaseVersions.size === 0) fail(source, "releases must contain at least one approved release");
  requireStringList(metadata.tags, "tags", source);
  if (metadata.facts !== undefined) {
    if (!Array.isArray(metadata.facts)) fail(source, "facts must be a list when supplied");
    for (const fact of metadata.facts) {
      if (!fact || typeof fact !== "object" || Array.isArray(fact)) fail(source, "each fact must be an object");
      const label = requiredString(fact.label, "facts.label", source);
      requiredString(fact.value, "facts.value", source);
      if (sensitiveFactPattern.test(label)) fail(source, "fact labels cannot describe credentials or activation material");
    }
  }
  if (metadata.notice !== undefined) {
    if (!metadata.notice || typeof metadata.notice !== "object" || Array.isArray(metadata.notice)) fail(source, "notice must be an object when supplied");
    if (!noticeTones.has(metadata.notice.tone)) fail(source, "notice.tone must be info or warning");
    requiredString(metadata.notice.title, "notice.title", source);
    requiredString(metadata.notice.message, "notice.message", source);
  }
  if (metadata.image !== undefined) {
    if (!metadata.image || typeof metadata.image !== "object" || Array.isArray(metadata.image)) fail(source, "image must be an object when supplied");
    const imagePath = requiredString(metadata.image.src, "image.src", source);
    requiredString(metadata.image.alt, "image.alt", source);
    if (!localImagePattern.test(imagePath) || imagePath.includes("..")) fail(source, "image.src must be a local /tool-images/ path");
  }
  if (metadata.resources !== undefined) {
    if (!Array.isArray(metadata.resources)) fail(source, "resources must be a list when supplied");
    const resourceIds = new Set();
    for (const resource of metadata.resources) {
      if (!resource || typeof resource !== "object" || Array.isArray(resource)) fail(source, "each resource must be an object");
      const resourceId = requiredString(resource.id, "resources.id", source);
      if (!idPattern.test(resourceId) || resourceIds.has(resourceId)) fail(source, "resources.id must be unique lowercase kebab-case");
      resourceIds.add(resourceId);
      requiredString(resource.title, "resources.title", source);
      if (!guideKinds.has(resource.kind)) fail(source, "resources.kind must be official-manual, internal-guide, or training");
      if (!guideFormats.has(resource.format)) fail(source, "resources.format must be pdf, pptx, or web");
      const hasUrl = resource.url !== undefined;
      const hasFile = resource.file !== undefined;
      if (hasUrl === hasFile) fail(source, "each resource must define exactly one url or file");
      if (hasUrl) requiredHttpsUrl(resource.url, "resources.url", source);
      if (hasFile && (!guideFilePattern.test(requiredString(resource.file, "resources.file", source)) || resource.file.includes(".."))) fail(source, "resources.file must use tool-id/filename.pdf or .pptx");
      const versions = requireStringList(resource.appliesTo, "resources.appliesTo", source);
      if (versions.some((version) => /[\r\n]/u.test(version))) fail(source, "resources.appliesTo contains an invalid version");
      requiredString(resource.owner, "resources.owner", source);
      const reviewedOn = requiredString(resource.reviewedOn, "resources.reviewedOn", source);
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(reviewedOn)) fail(source, "resources.reviewedOn must use YYYY-MM-DD");
      if (resource.accessNote !== undefined) requiredString(resource.accessNote, "resources.accessNote", source);
      if (resource.format === "web" && hasFile) fail(source, "web resources must use an HTTPS url");
      if (resource.format !== "web" && hasFile && !resource.file.endsWith(`.${resource.format}`)) fail(source, "resources.file extension must match resources.format");
    }
  }

  if (!/^## Install\b/mu.test(guide) || !/^## Support\b/mu.test(guide)) fail(source, "guide must include ## Install and ## Support sections");
  return { metadata, guide };
}

function releaseFilename(version) { return `${version}.json`; }

export function catalogEntryDirectory(categoryId, company, id) {
  return join(contentDirectory, ...categoryId.split("/"), slugifyId(company), id);
}

export function renderCatalogEntryFiles(metadata, guide, categoryId) {
  const source = `catalog entry ${metadata.id}`;
  const category = requiredString(categoryId, "categoryId", source);
  const directory = catalogEntryDirectory(category, metadata.company, metadata.id);
  const { company, category: ignoredCategory, releases, ...tool } = metadata;
  validateCatalogEntry(source, metadata, guide.trim());
  return { directory, files: [
    { path: join(dirname(directory), "vendor.json"), content: `${JSON.stringify({ name: company }, null, 2)}\n` },
    { path: join(directory, "tool.json"), content: `${JSON.stringify(tool, null, 2)}\n` },
    { path: join(directory, "guide.md"), content: `${guide.trim()}\n` },
    ...releases.map((release) => ({ path: join(directory, "releases", releaseFilename(release.version)), content: `${JSON.stringify(release, null, 2)}\n` })),
  ] };
}

export async function loadCatalogEntries(directory = contentDirectory) {
  const categories = await loadTaxonomy();
  const toolPaths = await findFiles(directory, "tool.json");
  if (toolPaths.length === 0) fail(directory, "must contain at least one tool.json entry");
  const entries = await Promise.all(toolPaths.map(async (toolPath) => {
    const source = toolPath;
    const relativeSegments = relative(directory, toolPath).split("/");
    const category = findCategoryForPath(relativeSegments, categories, source);
    const remaining = relativeSegments.slice(category.id.split("/").length);
    if (remaining.length !== 3 || remaining[2] !== "tool.json" || !idPattern.test(remaining[0]) || !idPattern.test(remaining[1])) fail(source, "must use <category>/<vendor>/<tool>/tool.json");
    const [vendorId, toolId] = remaining;
    const vendorPath = join(directory, ...category.id.split("/"), vendorId, "vendor.json");
    const vendor = await readJson(vendorPath);
    if (!vendor || typeof vendor !== "object" || Array.isArray(vendor)) fail(vendorPath, "must be an object");
    const company = requiredString(vendor.name, "name", vendorPath);
    if (slugifyId(company) !== vendorId) fail(vendorPath, "name must match its vendor directory");
    const tool = await readJson(toolPath);
    if (!tool || typeof tool !== "object" || Array.isArray(tool)) fail(toolPath, "must be an object");
    if (tool.id !== toolId) fail(toolPath, "id must match its tool directory");
    if (Object.hasOwn(tool, "company") || Object.hasOwn(tool, "category") || Object.hasOwn(tool, "releases")) fail(toolPath, "company, category, and releases belong in the directory, taxonomy, and releases directory");
    const guide = (await readFile(join(dirname(toolPath), "guide.md"), "utf8")).trim();
    const releasesDirectory = join(dirname(toolPath), "releases");
    const releasePaths = (await readdir(releasesDirectory, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => join(releasesDirectory, entry.name)).sort();
    if (releasePaths.length === 0) fail(releasesDirectory, "must contain at least one release JSON file");
    const releases = await Promise.all(releasePaths.map(async (releasePath) => {
      const release = await readJson(releasePath);
      if (!release || typeof release !== "object" || Array.isArray(release)) fail(releasePath, "must be an object");
      const version = requiredVersion(release.version, releasePath);
      if (releaseFilename(version) !== relative(releasesDirectory, releasePath)) fail(releasePath, "filename must match release version");
      const hasDownload = release.download !== undefined;
      const hasArtifact = release.artifact !== undefined;
      if (hasDownload === hasArtifact) fail(releasePath, "must define exactly one download or artifact target");
      if (hasDownload) return { version, download: requiredHttpsUrl(release.download, "download", releasePath) };
      const artifact = requiredArtifactPointer(release.artifact, "artifact", releasePath);
      const [artifactToolId, artifactVersion] = artifact.split("/");
      if (artifactToolId !== toolId) fail(releasePath, "artifact tool-id must match the tool directory");
      if (artifactVersion !== version) fail(releasePath, "artifact version must match the release filename");
      return { version, artifact };
    }));
    return validateCatalogEntry(source, { ...tool, company, category: category.label, releases }, guide);
  }));
  const ids = new Set(); const orders = new Set();
  for (const { metadata } of entries) {
    if (ids.has(metadata.id)) fail(directory, `duplicate id ${metadata.id}`);
    if (orders.has(metadata.order)) fail(directory, `duplicate order ${metadata.order}`);
    ids.add(metadata.id); orders.add(metadata.order);
  }
  return entries.sort((left, right) => left.metadata.order - right.metadata.order);
}

export function renderGeneratedCatalog(entries) {
  const tools = entries.map(({ metadata }) => { const { order, ...tool } = metadata; return tool; });
  const docs = Object.fromEntries(entries.map(({ metadata, guide }) => [metadata.id, guide]));
  return `// Generated from content/catalog/**/{tool.json,guide.md,releases/*.json} by scripts/build-catalog.mjs. Do not edit manually.\n\nexport const tools = ${JSON.stringify(tools, null, 2)};\n\nexport const docs = ${JSON.stringify(docs, null, 2)};\n`;
}

export async function writeGeneratedCatalog() {
  const contents = renderGeneratedCatalog(await loadCatalogEntries());
  await mkdir(dirname(generatedCatalogPath), { recursive: true });
  await writeFile(generatedCatalogPath, contents, "utf8");
  return contents;
}

export async function nextCatalogOrder() {
  const entries = await loadCatalogEntries();
  return Math.max(...entries.map(({ metadata }) => metadata.order)) + 1;
}
