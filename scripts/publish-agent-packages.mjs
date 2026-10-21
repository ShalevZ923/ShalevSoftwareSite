import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgentEntries, repositoryRoot } from "./agents-content.mjs";
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
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  await walk(root);
  return files;
}

export async function publishAgentPackages({ entries, sourceDirectory, destinationDirectory }) {
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
  const sourceRoot = resolve(sourceDirectory);
  const destinationRoot = resolve(destinationDirectory);
  await mkdir(destinationRoot, { recursive: true });
  if (sourceRoot !== destinationRoot) {
    for (const artifact of allowed) {
      const destination = join(destinationRoot, artifact);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(join(sourceRoot, artifact), destination);
    }
  }
  for (const file of await listFiles(destinationRoot)) {
    const artifact = posixRelative(destinationRoot, file);
    if (artifact.endsWith(".zip") && !allowed.has(artifact)) await rm(file);
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
