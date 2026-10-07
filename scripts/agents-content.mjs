import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import Ajv from "ajv";
import {
  fail,
  findFiles,
  idPattern,
  parseReleaseList,
  readJson,
  requiredArtifactPointer,
  requiredHttpsUrl,
  requiredId,
  requiredString,
  requiredVersion,
  requireStringList,
  repositoryRoot,
  slugifyId,
  validateOptionalFacts,
  validateOptionalImage,
  validateOptionalNotice,
  validateOwner,
} from "./content-shared.mjs";

export { parseReleaseList, repositoryRoot, slugifyId };

export const agentsDirectory = join(repositoryRoot, "content", "agents");
export const agentTypesPath = join(repositoryRoot, "content", "taxonomy", "agent-types.json");
export const generatedAgentsPath = join(repositoryRoot, "src", "generated", "agents.ts");

const ajv = new Ajv({ allErrors: true });
ajv.addFormat("catalog-date", (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
ajv.addFormat("catalog-https", (value) => {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
});
const entrySchema = ajv.compile(await readJson(join(repositoryRoot, "content/schemas/agent.schema.json")));
const releaseSchema = ajv.compile(await readJson(join(repositoryRoot, "content/schemas/agent-release.schema.json")));
const facets = await readJson(join(repositoryRoot, "content/taxonomy/agent-facets.json"));
function checkSchema(validate, value, source) {
  if (!validate(value)) fail(source, ajv.errorsText(validate.errors, { separator: "; " }));
}

export const packageTypes = new Map([
  ["skills", "Skill"],
  ["agent-packs", "Agent Pack"],
  ["role-packs", "Role Pack"],
  ["mcp-servers", "MCP Server"],
]);
export const riskLevels = new Set(["Low", "Medium", "High", "Unknown"]);
export const contentKinds = new Set(["skill", "script", "prompt", "config", "doc", "asset"]);
const mcpConfigTypes = new Set(["http", "sse", "stdio"]);
const contentPathPattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/;
const reservedPathPartPattern = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
function portablePathParts(value) {
  return value.split("/").every((part) => !/[. ]$/u.test(part) && !reservedPathPartPattern.test(part));
}
const mcpNamePattern = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const commandPattern = /^[A-Za-z0-9._+/-]+$/;
const sha256Pattern = /^[a-fA-F0-9]{64}$/;
const projectUnpackPattern = /^\.(?:agents|vscode)\/[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/;
const globalUnpackPattern = /^~\/\.(?:agents|vscode)\/[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/;
const blockedInstallCommands = new Set(["npx", "npm", "pnpm", "yarn", "bun"]);
const publicMcpHostPattern =
  /(?:^|\.)(?:vercel\.com|github\.com|githubusercontent\.com|openai\.com|anthropic\.com|npmjs\.com|npmjs\.org)$/iu;

export async function loadAgentTypes() {
  const taxonomy = await readJson(agentTypesPath);
  if (!taxonomy || typeof taxonomy !== "object" || Array.isArray(taxonomy) || !Array.isArray(taxonomy.types)) {
    fail(agentTypesPath, "must contain a types list");
  }
  const types = taxonomy.types.map((type, index) => {
    const source = `${agentTypesPath} type ${index + 1}`;
    if (!type || typeof type !== "object" || Array.isArray(type)) fail(source, "must be an object");
    const id = requiredId(type.id, "id", source);
    if (!packageTypes.has(id)) fail(source, "id must be skills, agent-packs, role-packs, or mcp-servers");
    if (type.label !== packageTypes.get(id)) fail(source, "label must match the canonical package type");
    return {
      id,
      label: requiredString(type.label, "label", source),
      description: requiredString(type.description, "description", source),
    };
  });
  if (types.length === 0) fail(agentTypesPath, "must contain at least one type");
  if (new Set(types.map((type) => type.id)).size !== types.length) fail(agentTypesPath, "must not repeat type ids");
  for (const expected of packageTypes.keys()) {
    if (!types.some((type) => type.id === expected)) fail(agentTypesPath, `must include ${expected}`);
  }
  return types;
}

function jsonValueIsSafe(value, field, source) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "string" && /[\r\n]/u.test(value)) fail(source, `${field} cannot contain line breaks`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => jsonValueIsSafe(item, `${field}[${index}]`, source));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      requiredString(key, `${field} key`, source);
      jsonValueIsSafe(nested, `${field}.${key}`, source);
    }
    return;
  }
  fail(source, `${field} must be JSON-serializable text, numbers, booleans, lists, or objects`);
}

function validateMcpInstall(mcp, source) {
  if (!mcp || typeof mcp !== "object" || Array.isArray(mcp)) fail(source, "install.mcp must be an object when supplied");
  const name = requiredString(mcp.name, "install.mcp.name", source);
  if (!mcpNamePattern.test(name)) fail(source, "install.mcp.name must be a filename-safe identifier");
  if (!mcp.config || typeof mcp.config !== "object" || Array.isArray(mcp.config)) {
    fail(source, "install.mcp.config must be an object");
  }
  jsonValueIsSafe(mcp.config, "install.mcp.config", source);
  if (mcp.config.type !== undefined && !mcpConfigTypes.has(mcp.config.type)) {
    fail(source, "install.mcp.config.type must be http, sse, or stdio");
  }
  if (mcp.config.url !== undefined) {
    const href = requiredHttpsUrl(mcp.config.url, "install.mcp.config.url", source);
    const hostname = new URL(href).hostname;
    if (publicMcpHostPattern.test(hostname)) {
      fail(source, "install.mcp.config.url must be an internal MCP host, not a public SaaS endpoint");
    }
  }
  if (mcp.config.command !== undefined) {
    const command = requiredString(mcp.config.command, "install.mcp.config.command", source);
    if (!commandPattern.test(command)) fail(source, "install.mcp.config.command must be a simple executable name or path");
    const executable = command.split("/").at(-1)?.toLocaleLowerCase();
    if (blockedInstallCommands.has(executable)) {
      fail(source, "install.mcp.config.command cannot use npm, npx, pnpm, yarn, or bun");
    }
  }
  if (mcp.config.args !== undefined) {
    if (!Array.isArray(mcp.config.args) || mcp.config.args.some((item) => typeof item !== "string")) {
      fail(source, "install.mcp.config.args must be a list of strings");
    }
  }
  if (mcp.config.env !== undefined) {
    if (!mcp.config.env || typeof mcp.config.env !== "object" || Array.isArray(mcp.config.env)) {
      fail(source, "install.mcp.config.env must be an object");
    }
    for (const [key, value] of Object.entries(mcp.config.env)) {
      requiredString(key, "install.mcp.config.env key", source);
      requiredString(value, `install.mcp.config.env.${key}`, source);
    }
  }
  return { name, config: mcp.config };
}

function validateUnpackPath(value, field, source, pattern, example) {
  const path = requiredString(value, field, source);
  if (path.includes("..") || path.includes("\\") || !pattern.test(path)) {
    fail(source, `${field} must be a relative unpack folder such as ${example}`);
  }
  return path;
}

function validateUnpack(unpack, source) {
  if (!unpack || typeof unpack !== "object" || Array.isArray(unpack)) fail(source, "install.unpack must be an object");
  return {
    project: validateUnpackPath(unpack.project, "install.unpack.project", source, projectUnpackPattern, ".agents/skills/example"),
    global: validateUnpackPath(unpack.global, "install.unpack.global", source, globalUnpackPattern, "~/.agents/skills/example"),
  };
}

export function validateInstall(install, source, hasZipRelease) {
  if (!install || typeof install !== "object" || Array.isArray(install)) fail(source, "install must be an object");
  if (install.unpack !== undefined && !hasZipRelease) fail(source, "install.unpack requires a ZIP artifact release");
  const unpack = install.unpack === undefined ? undefined : validateUnpack(install.unpack, source);
  const mcp = install.mcp === undefined ? undefined : validateMcpInstall(install.mcp, source);
  if (!unpack && !mcp) fail(source, "install requires unpack or mcp configuration");
  if (mcp) {
    const type = mcp.config.type;
    if (type === "http" || type === "sse" || mcp.config.url !== undefined) {
      if (mcp.config.url === undefined) fail(source, "http and sse MCP servers must define install.mcp.config.url");
    }
    if (type === "stdio" || (type === undefined && mcp.config.command !== undefined)) {
      if (mcp.config.command === undefined) fail(source, "stdio MCP servers must define install.mcp.config.command");
    }
  }
  return { ...(unpack ? { unpack } : {}), ...(mcp ? { mcp } : {}) };
}

function validateContents(contents, source) {
  if (!Array.isArray(contents)) fail(source, "contents must be a list");
  if (new Set(contents.map((item) => item.path)).size !== contents.length) fail(source, "contents must not repeat paths");
  return contents.map((item, index) => {
    const field = `contents[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) fail(source, `${field} must be an object`);
    const path = requiredString(item.path, `${field}.path`, source);
    if (!contentPathPattern.test(path) || path.includes("..") || !portablePathParts(path)) {
      fail(source, `${field}.path must be a portable relative path without parent segments`);
    }
    if (!contentKinds.has(item.kind)) fail(source, `${field}.kind must be skill, script, prompt, config, doc, or asset`);
    const note = item.note === undefined ? undefined : requiredString(item.note, `${field}.note`, source);
    return { path, kind: item.kind, ...(note ? { note } : {}) };
  });
}

function requiredSha256(value, field, source) {
  const digest = requiredString(value, field, source).toLocaleLowerCase();
  if (!sha256Pattern.test(digest)) fail(source, `${field} must be a 64-character SHA-256 hex digest`);
  return digest;
}

export function validateAgentReleaseRecords(releases, source, id) {
  if (!Array.isArray(releases)) fail(source, "releases must be a list");
  const releaseVersions = new Set();
  const normalized = [];
  for (const [releaseIndex, release] of releases.entries()) {
    const releaseField = `releases[${releaseIndex}]`;
    if (!release || typeof release !== "object" || Array.isArray(release)) fail(source, "each release must be an object");
    if (release.download !== undefined) fail(source, "agent releases must use a same-server ZIP artifact, not an external download URL");
    checkSchema(releaseSchema, release, `${source} ${releaseField}`);
    const version = requiredVersion(release.version, source, `${releaseField}.version`);
    if (releaseVersions.has(version)) fail(source, `${releaseField}.version must not repeat a version`);
    releaseVersions.add(version);
    if (release.artifact === undefined) {
      if (release.sha256 !== undefined) fail(source, `${releaseField}.sha256 requires an artifact`);
      if (release.archiveRoot !== undefined) fail(source, `${releaseField}.archiveRoot requires an artifact`);
      if (release.contents !== undefined) fail(source, `${releaseField}.contents requires an artifact`);
      if (release.review !== undefined) fail(source, `${releaseField}.review requires an artifact`);
      normalized.push({ version, releasedAt: release.releasedAt, ...(release.notes ? { notes: release.notes } : {}) });
      continue;
    }
    const artifact = requiredArtifactPointer(release.artifact, `${releaseField}.artifact`, source);
    const [artifactToolId, artifactVersion, filename] = artifact.split("/");
    if (artifactToolId !== id) fail(source, `${releaseField}.artifact tool-id must match the catalog id`);
    if (artifactVersion !== version) fail(source, `${releaseField}.artifact version must match the release version`);
    if (!/\.zip$/iu.test(filename)) fail(source, `${releaseField}.artifact must be a .zip file`);
    if (!release.review) fail(source, `${releaseField}.artifact requires release review date and evidence`);
    const archiveRoot = requiredString(release.archiveRoot, `${releaseField}.archiveRoot`, source);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(archiveRoot) || !portablePathParts(archiveRoot)) {
      fail(source, `${releaseField}.archiveRoot must be one safe top-level folder name`);
    }
    const contents = validateContents(release.contents, `${source} ${releaseField}`);
    if (contents.length === 0) fail(source, `${releaseField}.contents must list the ZIP contents`);
    normalized.push({
      version,
      releasedAt: release.releasedAt,
      ...(release.notes ? { notes: release.notes } : {}),
      artifact,
      sha256: requiredSha256(release.sha256, `${releaseField}.sha256`, source),
      archiveRoot,
      contents,
      review: release.review,
    });
  }
  return normalized;
}

function hasZipRelease(releases) {
  return releases.some((release) => release.artifact && /\.zip$/iu.test(release.artifact));
}

export function validateAgentEntry(source, metadata, guide) {
  const { publisher, packageType, releases: rawReleases, ...record } = metadata;
  checkSchema(entrySchema, record, source);
  const id = requiredId(metadata.id, "id", source);
  for (const field of ["name", "publisher", "packageType", "description", "icon"]) {
    requiredString(metadata[field], field, source);
  }
  if (![...packageTypes.values()].includes(metadata.packageType)) {
    fail(source, "packageType must be Skill, Agent Pack, Role Pack, or MCP Server");
  }
  if (!riskLevels.has(metadata.riskLevel)) fail(source, "riskLevel must be Low, Medium, High, or Unknown");
  validateContents(metadata.contents, source);
  requireStringList(metadata.highlights, "highlights", source);
  requireStringList(metadata.tags, "tags", source);
  validateOwner(metadata.maintainer, "maintainer", source);
  const releases = validateAgentReleaseRecords(rawReleases, source, id);
  const currentRelease = releases.find((release) => release.version === metadata.currentVersion);
  if (currentRelease?.contents) {
    const listingPaths = metadata.contents.map((item) => `${item.path}:${item.kind}`).sort();
    const releasePaths = currentRelease.contents.map((item) => `${item.path}:${item.kind}`).sort();
    if (JSON.stringify(listingPaths) !== JSON.stringify(releasePaths)) {
      fail(source, "current release contents must match the listing contents");
    }
  }
  if (metadata.install?.unpack) {
    for (const release of releases.filter((item) => item.artifact)) {
      for (const scope of ["project", "global"]) {
        if (metadata.install.unpack[scope].split("/").at(-1) !== release.archiveRoot) {
          fail(source, `install.unpack.${scope} folder must match release archiveRoot ${release.archiveRoot}`);
        }
      }
    }
  }
  if (releases.length > 0 && !releases.some((release) => release.version === metadata.currentVersion)) {
    fail(source, "currentVersion must reference a release");
  }
  if (releases.length === 0 && metadata.currentVersion !== undefined) fail(source, "currentVersion requires a release");
  if (metadata.install !== undefined) {
    validateInstall(metadata.install, source, hasZipRelease(releases));
    if (metadata.install.mcp !== undefined && packageType !== "MCP Server") fail(source, "install.mcp is only valid for MCP Server entries");
  }
  for (const capability of metadata.capabilities) {
    if (!facets.capabilities.some(({ id }) => id === capability)) fail(source, `unknown capability ${capability}`);
  }
  const targets = new Set();
  for (const compatibility of metadata.compatibility) {
    if (!facets.targets.some(({ id }) => id === compatibility.target)) fail(source, `unknown compatibility target ${compatibility.target}`);
    if (targets.has(compatibility.target)) fail(source, "compatibility must not repeat targets");
    targets.add(compatibility.target);
    if (compatibility.status === "verified" && (!compatibility.verifiedOn || !compatibility.evidence || compatibility.version !== metadata.currentVersion || !metadata.currentVersion)) {
      fail(source, "verified compatibility requires evidence, verifiedOn, and the current version");
    }
  }
  if ((packageType === "MCP Server") !== (metadata.mcp !== undefined)) fail(source, "mcp metadata is required only for MCP Server entries");
  if (metadata.mcp?.transport === "stdio" && metadata.mcp.hosting !== "local") fail(source, "stdio MCP servers must use local hosting");
  if (metadata.install?.mcp) {
    const configuredType = metadata.install.mcp.config.type ?? (metadata.install.mcp.config.url ? "http" : "stdio");
    const transport = metadata.mcp?.transport;
    if ((transport === "stdio" && configuredType !== "stdio") ||
      (transport === "streamable-http" && configuredType !== "http") ||
      (transport === "sse" && configuredType !== "sse") ||
      !["stdio", "streamable-http", "sse"].includes(transport)) {
      fail(source, "install.mcp.config type must match the declared MCP transport");
    }
  }
  if (metadata.mcp && new Set(metadata.mcp.tools.map((tool) => tool.name)).size !== metadata.mcp.tools.length) fail(source, "mcp.tools must not repeat names");
  if (metadata.review.status === "reviewed" && (!metadata.review.date || !metadata.review.evidence || metadata.review.version !== metadata.currentVersion || !metadata.currentVersion)) {
    fail(source, "reviewed entries require evidence, date, and the current version");
  }
  if (metadata.status === "supported" && (metadata.review.status !== "reviewed" || !metadata.source?.revision || !metadata.license || !metadata.compatibility.some((item) => item.status === "verified") || metadata.riskLevel === "Unknown" || metadata.maintainer.email.endsWith(".invalid"))) {
    fail(source, "supported entries require reviewed provenance, license, assessed risk, verified compatibility, and an assigned owner");
  }
  validateOptionalFacts(metadata.facts, source);
  validateOptionalNotice(metadata.notice, source);
  validateOptionalImage(metadata.image, source);
  if (!/^## Overview\b/mu.test(guide) || !/^## Support\b/mu.test(guide)) fail(source, "guide must include ## Overview and ## Support sections");
  // Publish only schema-checked fields, including normalized release records.
  const { $schema, ...published } = record;
  return { metadata: { ...published, publisher, packageType, releases }, guide };
}

function releaseFilename(version) {
  return `${version}.json`;
}

function findTypeForPath(pathSegments, types, source) {
  const type = types.find(({ id }) => pathSegments[0] === id);
  if (!type) fail(source, "must be located beneath a type defined in content/taxonomy/agent-types.json");
  return type;
}

export async function loadAgentEntries(directory = agentsDirectory) {
  const types = await loadAgentTypes();
  const agentPaths = await findFiles(directory, "agent.json");
  if (agentPaths.length === 0) fail(directory, "must contain at least one agent.json entry");
  const entries = await Promise.all(agentPaths.map(async (agentPath) => {
    const source = agentPath;
    const relativeSegments = relative(directory, agentPath).split("/");
    const type = findTypeForPath(relativeSegments, types, source);
    if (relativeSegments.length !== 4 || relativeSegments[3] !== "agent.json" || !idPattern.test(relativeSegments[1]) || !idPattern.test(relativeSegments[2])) {
      fail(source, "must use <type>/<publisher>/<package>/agent.json");
    }
    const [, publisherId, packageId] = relativeSegments;
    const publisherPath = join(directory, type.id, publisherId, "publisher.json");
    const publisherFile = await readJson(publisherPath);
    if (!publisherFile || typeof publisherFile !== "object" || Array.isArray(publisherFile)) fail(publisherPath, "must be an object");
    const publisher = requiredString(publisherFile.name, "name", publisherPath);
    if (slugifyId(publisher) !== publisherId) fail(publisherPath, "name must match its publisher directory");
    const agent = await readJson(agentPath);
    if (!agent || typeof agent !== "object" || Array.isArray(agent)) fail(agentPath, "must be an object");
    if (agent.id !== packageId) fail(agentPath, "id must match its package directory");
    if (Object.hasOwn(agent, "publisher") || Object.hasOwn(agent, "packageType") || Object.hasOwn(agent, "releases")) {
      fail(agentPath, "publisher, packageType, and releases belong in the directory, taxonomy, and releases directory");
    }
    const guide = (await readFile(join(dirname(agentPath), "guide.md"), "utf8")).trim();
    const releasesDirectory = join(dirname(agentPath), "releases");
    const releasePaths = (await readdir(releasesDirectory, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(releasesDirectory, entry.name))
      .sort();
    const releases = await Promise.all(releasePaths.map(async (releasePath) => {
      const release = await readJson(releasePath);
      if (!release || typeof release !== "object" || Array.isArray(release)) fail(releasePath, "must be an object");
      const version = requiredVersion(release.version, releasePath);
      if (releaseFilename(version) !== relative(releasesDirectory, releasePath)) fail(releasePath, "filename must match release version");
      return release;
    }));
    const validated = validateAgentEntry(source, {
      ...agent,
      publisher,
      packageType: type.label,
      releases,
    }, guide);
    return { ...validated, guidePath: `/${relative(repositoryRoot, join(dirname(agentPath), "guide.md")).replaceAll("\\", "/")}` };
  }));
  const ids = new Set();
  for (const { metadata } of entries) {
    if (ids.has(metadata.id)) fail(directory, `duplicate id ${metadata.id}`);
    ids.add(metadata.id);
  }
  return entries.sort((left, right) => left.metadata.id.localeCompare(right.metadata.id));
}

export function renderGeneratedAgents(entries) {
  const agents = entries.map(({ metadata, guidePath }) => ({ ...metadata, guidePath }));
  return `// Generated from content/agents by scripts/build-agents.mjs. Do not edit manually.\nimport type { AgentPackage } from "../agentTypes";\n\nexport const agents = ${JSON.stringify(agents, null, 2)} satisfies AgentPackage[];\n`;
}

export async function writeGeneratedAgents() {
  const contents = renderGeneratedAgents(await loadAgentEntries());
  await mkdir(dirname(generatedAgentsPath), { recursive: true });
  await writeFile(generatedAgentsPath, contents, "utf8");
  return contents;
}
