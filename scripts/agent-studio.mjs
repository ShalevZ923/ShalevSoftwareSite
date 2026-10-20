import { tmpdir } from "node:os";
import {
  assertRevision,
  coordinateMutation,
  publishTransaction,
  sourceSnapshot,
  assertSourceSnapshot,
  recoverTransactions,
} from "./mutation-coordinator.mjs";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
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

export function saveAgentStudioEntry(options) {
  return coordinateMutation(() => persistAgentStudioEntry(options));
}

async function persistAgentStudioEntry({
  metadata,
  guide,
  existingId,
  directory = agentsDirectory,
  generatedPath = generatedAgentsPath,
  stateDirectory = join(dirname(directory), ".tool-atlas-state"),
  revision,
}) {
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    typeof guide !== "string"
  ) {
    throw new Error("metadata and guide are required");
  }
  if (
    typeof metadata.id !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.id) ||
    typeof metadata.publisher !== "string"
  ) {
    throw new Error("Agent id or publisher is invalid");
  }
  const root = await realpath(directory);
  directory = root;
  await recoverTransactions(stateDirectory, [root, dirname(generatedPath)]);
  const snapshot = await sourceSnapshot(root);
  const entries = await loadAgentEntries(root);
  const existing = existingId && entries.find((item) => item.metadata.id === existingId);
  if (existingId && !existing) throw new Error(`Agent ${existingId} not found`);
  if (
    existing &&
    (metadata.id !== existingId ||
      metadata.publisher !== existing.metadata.publisher ||
      metadata.packageType !== existing.metadata.packageType)
  ) {
    throw new Error("id, publisher, and package type cannot be changed after creation");
  }
  if (!existing && entries.some((item) => item.metadata.id === metadata.id)) {
    throw new Error(`Agent ${metadata.id} already exists`);
  }
  if (
    existing &&
    existing.metadata.releases.some(
      (release) => !metadata.releases?.some((item) => item.version === release.version),
    )
  ) {
    throw new Error("Existing release versions cannot be removed in Developer Studio");
  }
  if (existing) assertRevision(revision, existing);
  const publisherId = slugifyId(metadata.publisher);
  const typeId = [...packageTypes].find(([, label]) => label === metadata.packageType)?.[0];
  if (!publisherId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publisherId) || !typeId) {
    throw new Error("Publisher or package type is invalid");
  }
  const folder = join(directory, typeId, publisherId, metadata.id);
  const publisherFolder = dirname(folder);

  if (existsSync(publisherFolder)) {
    if (!inside(root, await realpath(publisherFolder)))
      throw new Error("Publisher directory escapes agent source");
    const publisherFile = join(publisherFolder, "publisher.json");
    const currentPublisher = JSON.parse(await readFile(publisherFile, "utf8"));
    if (currentPublisher.name !== metadata.publisher)
      throw new Error("Publisher directory belongs to another name");
  }
  if (existing) {
    if (!inside(root, await realpath(folder)))
      throw new Error("Agent directory escapes agent source");
  } else if (existsSync(folder)) {
    throw new Error("Agent source directory already exists");
  }

  const { publisher, packageType, releases, guidePath, ...record } = metadata;
  const validated = validateAgentEntry(
    folder,
    { ...record, publisher, packageType, releases },
    guide.trim(),
  );
  const {
    publisher: _publisher,
    packageType: _packageType,
    releases: _releases,
    ...stored
  } = validated.metadata;

  const changes = [
    { path: join(folder, "agent.json"), content: JSON.stringify(stored, null, 2) + "\n" },
    { path: join(folder, "guide.md"), content: guide.trim() + "\n" },
    ...releases.map((release) => ({
      path: join(folder, "releases", `${release.version}.json`),
      content: JSON.stringify(release, null, 2) + "\n",
    })),
  ];
  if (!existsSync(join(publisherFolder, "publisher.json")))
    changes.unshift({
      path: join(publisherFolder, "publisher.json"),
      content: JSON.stringify({ name: publisher }) + "\n",
    });
  const stage = await mkdtemp(join(tmpdir(), "atlas-agent-save-"));
  try {
    const stagedRoot = join(stage, "agents");
    await cp(root, stagedRoot, { recursive: true });
    for (const change of changes) {
      const stagedPath = join(stagedRoot, relative(root, change.path));
      await mkdir(dirname(stagedPath), { recursive: true });
      await writeFile(stagedPath, change.content, "utf8");
    }
    const accepted = await loadAgentEntries(stagedRoot);
    await publishTransaction(
      [...changes, { path: generatedPath, content: renderGeneratedAgents(accepted) }],
      {
        stateDirectory,
        roots: [root, dirname(generatedPath)],
        precondition: () => assertSourceSnapshot(root, snapshot),
      },
    );
    return accepted.find((entry) => entry.metadata.id === metadata.id);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
