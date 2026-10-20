import { existsSync } from "node:fs";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import {
  agentsDirectory,
  generatedAgentsPath,
  loadAgentEntries,
  packageTypes,
  renderGeneratedAgents,
  repositoryRoot,
  slugifyId,
  validateAgentEntry,
} from "./agents-content.mjs";

function inside(root, candidate) {
  const path = relative(root, candidate);
  return path && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export async function saveAgentStudioEntry({
  metadata,
  guide,
  existingId,
  directory = agentsDirectory,
  generatedPath = generatedAgentsPath,
}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || typeof guide !== "string") {
    throw new Error("metadata and guide are required");
  }
  if (typeof metadata.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.id) ||
    typeof metadata.publisher !== "string") {
    throw new Error("Agent id or publisher is invalid");
  }
  const entries = await loadAgentEntries(directory);
  const existing = existingId && entries.find((item) => item.metadata.id === existingId);
  if (existingId && !existing) throw new Error(`Agent ${existingId} not found`);
  if (existing && (metadata.id !== existingId || metadata.publisher !== existing.metadata.publisher ||
    metadata.packageType !== existing.metadata.packageType)) {
    throw new Error("id, publisher, and package type cannot be changed after creation");
  }
  if (!existing && entries.some((item) => item.metadata.id === metadata.id)) {
    throw new Error(`Agent ${metadata.id} already exists`);
  }
  if (existing && existing.metadata.releases.some((release) => !metadata.releases?.some((item) => item.version === release.version))) {
    throw new Error("Existing release versions cannot be removed in Developer Studio");
  }
  const publisherId = slugifyId(metadata.publisher);
  const typeId = [...packageTypes].find(([, label]) => label === metadata.packageType)?.[0];
  if (!publisherId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publisherId) || !typeId) {
    throw new Error("Publisher or package type is invalid");
  }
  const folder = join(directory, typeId, publisherId, metadata.id);
  const publisherFolder = dirname(folder);
  const root = await realpath(directory);
  const typeFolder = await realpath(join(directory, typeId));
  if (!inside(root, typeFolder)) throw new Error("Package type directory escapes agent source");
  if (existsSync(publisherFolder)) {
    if (!inside(root, await realpath(publisherFolder))) throw new Error("Publisher directory escapes agent source");
    const publisherFile = join(publisherFolder, "publisher.json");
    const currentPublisher = JSON.parse(await readFile(publisherFile, "utf8"));
    if (currentPublisher.name !== metadata.publisher) throw new Error("Publisher directory belongs to another name");
  }
  if (existing) {
    if (!inside(root, await realpath(folder))) throw new Error("Agent directory escapes agent source");
  } else if (existsSync(folder)) {
    throw new Error("Agent source directory already exists");
  }

  const { publisher, packageType, releases, guidePath, ...record } = metadata;
  const validated = validateAgentEntry(folder, { ...record, publisher, packageType, releases }, guide.trim());
  const path = existing?.guidePath ?? `/content/agents/${typeId}/${publisherId}/${metadata.id}/guide.md`;
  const nextEntries = existing
    ? entries.map((item) => item.metadata.id === existingId ? { ...validated, guidePath: path } : item)
    : [...entries, { ...validated, guidePath: path }];
  const generated = renderGeneratedAgents(nextEntries.sort((a, b) => a.metadata.id.localeCompare(b.metadata.id)));
  const { publisher: _publisher, packageType: _packageType, releases: _releases, ...stored } = validated.metadata;

  await mkdir(join(folder, "releases"), { recursive: true });
  if (!existsSync(join(publisherFolder, "publisher.json"))) {
    await writeFile(join(publisherFolder, "publisher.json"), JSON.stringify({ name: publisher }) + "\n", "utf8");
  }
  await writeFile(join(folder, "agent.json"), JSON.stringify(stored, null, 2) + "\n", "utf8");
  await writeFile(join(folder, "guide.md"), guide.trim() + "\n", "utf8");
  for (const release of releases) {
    await writeFile(join(folder, "releases", `${release.version}.json`), JSON.stringify(release, null, 2) + "\n", "utf8");
  }
  await writeFile(generatedPath, generated, "utf8");
  return validated.metadata;
}
