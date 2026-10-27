import { copyFile, lstat, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgentEntries, repositoryRoot } from "./agents-content.mjs";
import { loadCatalogEntries } from "./catalog-content.mjs";
import { auditAgentArtifacts } from "./check-agent-artifacts.mjs";
import { downloadableAgentArtifacts, isDownloadableAgentRelease } from "./agent-publication.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function posixRelative(root, file) {
  return relative(root, file).split(sep).join("/");
}

async function listFiles(root) {
  const files = [];
  try {
    if ((await lstat(root)).isSymbolicLink())
      throw new Error("Package destination cannot be a symbolic link");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const walk = async (dir) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Package destination contains a symbolic link: ${path}`);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  await walk(root);
  return files;
}

export async function publishAgentPackages({
  entries,
  softwareEntries = [],
  sourceDirectory,
  destinationDirectory,
}) {
  const publishable = entries.map((entry) => ({
    ...entry,
    metadata: {
      ...entry.metadata,
      releases: (entry.metadata.releases ?? []).filter((release) =>
        isDownloadableAgentRelease(entry.metadata, release),
      ),
    },
  }));
  const audit = await auditAgentArtifacts(publishable, sourceDirectory);
  if (audit.errors.length) {
    throw new Error(audit.errors.join("\n"));
  }
  const allowed = downloadableAgentArtifacts(entries);
  const declaredAgents = new Set(
    entries.flatMap(({ metadata }) =>
      (metadata.releases ?? []).map((release) => release.artifact).filter(Boolean),
    ),
  );
  const software = new Set(
    softwareEntries.flatMap(({ metadata }) =>
      (metadata.releases ?? []).map((release) => release.artifact).filter(Boolean),
    ),
  );
  const pathsByCasefold = new Map();
  for (const artifact of [...declaredAgents, ...software]) {
    const key = artifact.toLowerCase();
    if (pathsByCasefold.has(key) && pathsByCasefold.get(key) !== artifact)
      throw new Error(`Artifact paths differ only by case: ${artifact}`);
    pathsByCasefold.set(key, artifact);
  }
  for (const artifact of declaredAgents) {
    if (software.has(artifact))
      throw new Error(`Agent and software artifact paths collide: ${artifact}`);
  }
  const sourceRoot = resolve(sourceDirectory);
  const destinationRoot = resolve(destinationDirectory);
  const existing = await listFiles(destinationRoot);
  for (const file of existing) {
    const artifact = posixRelative(destinationRoot, file);
    const canonical = pathsByCasefold.get(artifact.toLowerCase());
    if (canonical && canonical !== artifact)
      throw new Error(`Destination artifact path has unexpected casing: ${artifact}`);
    if (artifact.endsWith(".zip") && !software.has(artifact) && !declaredAgents.has(artifact))
      throw new Error(`Unrecognized ZIP in destination; review it before publishing: ${artifact}`);
  }
  const staging = await mkdtemp(join(tmpdir(), "tool-atlas-publish-"));
  try {
    if (sourceRoot !== destinationRoot) {
      for (const artifact of allowed) {
        const staged = join(staging, artifact);
        await mkdir(dirname(staged), { recursive: true });
        await copyFile(join(sourceRoot, artifact), staged);
      }
      const stagedAudit = await auditAgentArtifacts(publishable, staging);
      if (stagedAudit.errors.length) throw new Error(stagedAudit.errors.join("\n"));
    }
    await mkdir(destinationRoot, { recursive: true });
    if (sourceRoot !== destinationRoot) {
      for (const artifact of allowed) {
        const destination = join(destinationRoot, artifact);
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(join(staging, artifact), destination);
      }
    }
    for (const file of existing) {
      const artifact = posixRelative(destinationRoot, file);
      if (artifact.endsWith(".zip") && declaredAgents.has(artifact) && !allowed.has(artifact))
        await rm(file);
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return { published: [...allowed].sort() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceDirectory = option("--source") ?? join(repositoryRoot, "packages");
  const destinationDirectory = option("--dest") ?? sourceDirectory;
  if (!sourceDirectory || !destinationDirectory) {
    console.error("Usage: pnpm agents:publish -- --source packages --dest /path/to/volume");
    process.exitCode = 2;
  } else {
    try {
      const result = await publishAgentPackages({
        entries: await loadAgentEntries(),
        softwareEntries: await loadCatalogEntries(),
        sourceDirectory,
        destinationDirectory,
      });
      console.log(
        `Published ${result.published.length} agent artifact${result.published.length === 1 ? "" : "s"} to ${destinationDirectory}.`,
      );
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
