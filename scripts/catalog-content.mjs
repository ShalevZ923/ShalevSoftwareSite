import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const contentDirectory = join(repositoryRoot, "content", "tools");
export const generatedCatalogPath = join(repositoryRoot, "src", "generated", "catalog.ts");

const platforms = new Set(["Windows", "Linux", "macOS", "Web"]);
const lifecycles = new Set(["Current", "New", "Legacy"]);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const localImagePattern = /^\/tool-images\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const sensitiveFactPattern = /key|activation|password|token/i;

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

export function slugifyId(value) {
  return value
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseCatalogFile(source, contents) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(contents);
  if (!match) fail(source, "must begin with JSON front matter between --- lines");

  let metadata;
  try {
    metadata = JSON.parse(match[1]);
  } catch (error) {
    fail(source, `front matter must be valid JSON (${error.message})`);
  }
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    fail(source, "front matter must be a JSON object");
  }

  return validateCatalogEntry(source, metadata, match[2].trim());
}

export function validateCatalogEntry(source, metadata, guide) {
  const id = requiredString(metadata.id, "id", source);
  if (!idPattern.test(id)) fail(source, "id must be lowercase kebab-case");
  if (basename(source, ".md") !== id) fail(source, "filename must match the id");

  const order = metadata.order;
  if (!Number.isSafeInteger(order) || order < 1) fail(source, "order must be a positive integer");

  for (const field of ["name", "company", "category", "description", "version", "updated", "icon"]) {
    requiredString(metadata[field], field, source);
  }

  const entryPlatforms = requireStringList(metadata.platforms, "platforms", source);
  if (entryPlatforms.some((platform) => !platforms.has(platform))) {
    fail(source, "platforms contains an unsupported value");
  }
  if (!lifecycles.has(metadata.lifecycle)) fail(source, "lifecycle must be Current, New, or Legacy");

  if (!metadata.support || typeof metadata.support !== "object" || Array.isArray(metadata.support)) {
    fail(source, "support must be an object");
  }
  for (const field of ["name", "team", "initials", "email"]) requiredString(metadata.support[field], `support.${field}`, source);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(metadata.support.email)) fail(source, "support.email must be an email address");

  const download = requiredString(metadata.download, "download", source);
  try {
    const url = new URL(download);
    if (url.protocol !== "https:" || url.username || url.password) fail(source, "download must be a credential-free HTTPS URL");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${source}:`)) throw error;
    fail(source, "download must be a valid HTTPS URL");
  }

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
  if (metadata.image !== undefined) {
    if (!metadata.image || typeof metadata.image !== "object" || Array.isArray(metadata.image)) fail(source, "image must be an object when supplied");
    const sourcePath = requiredString(metadata.image.src, "image.src", source);
    requiredString(metadata.image.alt, "image.alt", source);
    if (!localImagePattern.test(sourcePath) || sourcePath.includes("..")) fail(source, "image.src must be a local /tool-images/ path");
  }

  if (!/^## Install\b/mu.test(guide) || !/^## Support\b/mu.test(guide)) {
    fail(source, "guide must include ## Install and ## Support sections");
  }

  return { metadata, guide };
}

export async function loadCatalogEntries(directory = contentDirectory) {
  const filenames = (await readdir(directory)).filter((filename) => filename.endsWith(".md")).sort();
  if (filenames.length === 0) fail(directory, "must contain at least one .md entry");

  const entries = await Promise.all(
    filenames.map(async (filename) => {
      const path = join(directory, filename);
      return parseCatalogFile(path, await readFile(path, "utf8"));
    }),
  );
  const ids = new Set();
  const orders = new Set();
  for (const { metadata } of entries) {
    if (ids.has(metadata.id)) fail(directory, `duplicate id ${metadata.id}`);
    if (orders.has(metadata.order)) fail(directory, `duplicate order ${metadata.order}`);
    ids.add(metadata.id);
    orders.add(metadata.order);
  }
  return entries.sort((left, right) => left.metadata.order - right.metadata.order);
}

export function renderGeneratedCatalog(entries) {
  const tools = entries.map(({ metadata }) => {
    const { order, ...tool } = metadata;
    return tool;
  });
  const docs = Object.fromEntries(entries.map(({ metadata, guide }) => [metadata.id, guide]));
  return `// Generated from content/tools/*.md by scripts/build-catalog.mjs. Do not edit manually.\n\nexport const tools = ${JSON.stringify(tools, null, 2)};\n\nexport const docs = ${JSON.stringify(docs, null, 2)};\n`;
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

export function renderCatalogFile(metadata, guide) {
  validateCatalogEntry(join(contentDirectory, `${metadata.id}.md`), metadata, guide.trim());
  return `---\n${JSON.stringify(metadata, null, 2)}\n---\n${guide.trim()}\n`;
}
