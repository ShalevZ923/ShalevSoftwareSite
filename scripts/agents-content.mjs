import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
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
  requireInstallOrGuideSections,
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

export const packageTypes = new Map([
  ["skills", "Skill"],
  ["agent-packs", "Agent Pack"],
  ["role-packs", "Role Pack"],
  ["mcp-servers", "MCP Server"],
]);
export const riskLevels = new Set(["Low", "Medium", "High"]);
export const contentKinds = new Set(["skill", "script", "prompt", "config", "doc"]);
const mcpConfigTypes = new Set(["http", "sse", "stdio"]);
const contentPathPattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/;
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
  if (!hasZipRelease) fail(source, "each agent package must include a ZIP artifact release");
  const unpack = validateUnpack(install.unpack, source);
  const mcp = install.mcp === undefined ? undefined : validateMcpInstall(install.mcp, source);
  if (mcp) {
    const type = mcp.config.type;
    if (type === "http" || type === "sse" || mcp.config.url !== undefined) {
      if (mcp.config.url === undefined) fail(source, "http and sse MCP servers must define install.mcp.config.url");
    }
    if (type === "stdio" || (type === undefined && mcp.config.command !== undefined)) {
      if (mcp.config.command === undefined) fail(source, "stdio MCP servers must define install.mcp.config.command");
    }
  }
  return { unpack, ...(mcp ? { mcp } : {}) };
}

function validateContents(contents, source) {
  if (!Array.isArray(contents) || contents.length === 0) fail(source, "contents must be a non-empty list");
  return contents.map((item, index) => {
    const field = `contents[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) fail(source, `${field} must be an object`);
    const path = requiredString(item.path, `${field}.path`, source);
    if (!contentPathPattern.test(path) || path.includes("..")) {
      fail(source, `${field}.path must be a relative file path without parent segments`);
    }
    if (!contentKinds.has(item.kind)) fail(source, `${field}.kind must be skill, script, prompt, config, or doc`);
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
  if (!Array.isArray(releases) || releases.length === 0) fail(source, "releases must be a non-empty list");
  const releaseVersions = new Set();
  const normalized = [];
  for (const [releaseIndex, release] of releases.entries()) {
    const releaseField = `releases[${releaseIndex}]`;
    if (!release || typeof release !== "object" || Array.isArray(release)) fail(source, "each release must be an object");
    if (release.download !== undefined) fail(source, "agent releases must use a same-server ZIP artifact, not an external download URL");
    const version = requiredVersion(release.version, source, `${releaseField}.version`);
    if (releaseVersions.has(version)) fail(source, `${releaseField}.version must not repeat a version`);
    releaseVersions.add(version);
    const artifact = requiredArtifactPointer(release.artifact, `${releaseField}.artifact`, source);
    const [artifactToolId, artifactVersion, filename] = artifact.split("/");
    if (artifactToolId !== id) fail(source, `${releaseField}.artifact tool-id must match the catalog id`);
    if (artifactVersion !== version) fail(source, `${releaseField}.artifact version must match the release version`);
    if (!/\.zip$/iu.test(filename)) fail(source, `${releaseField}.artifact must be a .zip file`);
    normalized.push({
      version,
      artifact,
      sha256: requiredSha256(release.sha256, `${releaseField}.sha256`, source),
    });
  }
  return normalized;
}

function hasZipRelease(releases) {
  return releases.some((release) => release.artifact && /\.zip$/iu.test(release.artifact));
}

export function validateAgentEntry(source, metadata, guide) {
  const id = requiredId(metadata.id, "id", source);
  if (!Number.isSafeInteger(metadata.order) || metadata.order < 1) fail(source, "order must be a positive integer");
  for (const field of ["name", "publisher", "packageType", "description", "updated", "icon"]) {
    requiredString(metadata[field], field, source);
  }
  if (![...packageTypes.values()].includes(metadata.packageType)) {
    fail(source, "packageType must be Skill, Agent Pack, Role Pack, or MCP Server");
  }
  if (!riskLevels.has(metadata.riskLevel)) fail(source, "riskLevel must be Low, Medium, or High");
  requireStringList(metadata.permissions, "permissions", source);
  if (metadata.risks !== undefined) requireStringList(metadata.risks, "risks", source);
  validateContents(metadata.contents, source);
  requireStringList(metadata.tags, "tags", source);
  validateOwner(metadata.maintainer, "maintainer", source);
  const releases = validateAgentReleaseRecords(metadata.releases, source, id);
  validateInstall(metadata.install, source, hasZipRelease(releases));
  validateOptionalFacts(metadata.facts, source);
  validateOptionalNotice(metadata.notice, source);
  validateOptionalImage(metadata.image, source);
  requireInstallOrGuideSections(guide, source);
  return { metadata, guide };
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
    const releasePaths = (await readdir(releasesDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(releasesDirectory, entry.name))
      .sort();
    if (releasePaths.length === 0) fail(releasesDirectory, "must contain at least one release JSON file");
    const releases = await Promise.all(releasePaths.map(async (releasePath) => {
      const release = await readJson(releasePath);
      if (!release || typeof release !== "object" || Array.isArray(release)) fail(releasePath, "must be an object");
      const version = requiredVersion(release.version, releasePath);
      if (releaseFilename(version) !== relative(releasesDirectory, releasePath)) fail(releasePath, "filename must match release version");
      if (release.download !== undefined) fail(releasePath, "agent releases must use a same-server ZIP artifact, not an external download URL");
      const artifact = requiredArtifactPointer(release.artifact, "artifact", releasePath);
      const [artifactToolId, artifactVersion, filename] = artifact.split("/");
      if (artifactToolId !== packageId) fail(releasePath, "artifact tool-id must match the package directory");
      if (artifactVersion !== version) fail(releasePath, "artifact version must match the release filename");
      if (!/\.zip$/iu.test(filename)) fail(releasePath, "artifact must be a .zip file");
      return {
        version,
        artifact,
        sha256: requiredSha256(release.sha256, "sha256", releasePath),
      };
    }));
    return validateAgentEntry(source, {
      ...agent,
      publisher,
      packageType: type.label,
      releases,
    }, guide);
  }));
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

export function renderGeneratedAgents(entries) {
  const agents = entries.map(({ metadata }) => {
    const { order, ...agent } = metadata;
    return agent;
  });
  const docs = Object.fromEntries(entries.map(({ metadata, guide }) => [metadata.id, guide]));
  return `// Generated from content/agents/**/{agent.json,guide.md,releases/*.json} by scripts/build-agents.mjs. Do not edit manually.\n\nexport const agents = ${JSON.stringify(agents, null, 2)};\n\nexport const agentDocs = ${JSON.stringify(docs, null, 2)};\n`;
}

export async function writeGeneratedAgents() {
  const contents = renderGeneratedAgents(await loadAgentEntries());
  await mkdir(dirname(generatedAgentsPath), { recursive: true });
  await writeFile(generatedAgentsPath, contents, "utf8");
  return contents;
}
