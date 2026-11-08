import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgentEntries, repositoryRoot } from "./agents-content.mjs";
import { inspectAgentZip } from "./inspect-agent-zip.mjs";

function isInside(root, candidate) {
  const path = relative(root, candidate);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export async function auditAgentArtifacts(entries, packagesDirectory) {
  const declared = entries.flatMap(({ metadata }) =>
    metadata.releases
      .filter((release) => release.artifact)
      .map((release) => ({ id: metadata.id, ...release })),
  );
  const errors = [];
  if (declared.length === 0) return { declared: 0, errors };
  let root;
  try {
    root = await realpath(packagesDirectory);
  } catch {
    return {
      declared: declared.length,
      errors: [`Package directory does not exist: ${packagesDirectory}`],
    };
  }
  for (const release of declared) {
    const label = `${release.id}@${release.version}`;
    try {
      const path = await realpath(join(root, release.artifact));
      if (!isInside(root, path)) throw new Error("artifact escapes package directory");
      if (!(await stat(path)).isFile()) throw new Error("artifact is not a regular file");
      const digest = createHash("sha256");
      for await (const chunk of createReadStream(path)) digest.update(chunk);
      if (digest.digest("hex") !== release.sha256)
        throw new Error("SHA-256 does not match release metadata");
      await inspectAgentZip(path, release.archiveRoot, release.contents);
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }
  return { declared: declared.length, errors };
}

export function trackedAgentEntries(entries, sources) {
  const requested = new Set(sources.map((source) => `${source.id}@${source.version}`));
  const selected = entries.map((entry) => ({
    ...entry,
    metadata: {
      ...entry.metadata,
      releases: entry.metadata.releases.filter((release) =>
        requested.has(`${entry.metadata.id}@${release.version}`),
      ),
    },
  }));
  const declared = new Set(
    selected.flatMap((entry) =>
      entry.metadata.releases
        .filter((release) => release.artifact)
        .map((release) => `${entry.metadata.id}@${release.version}`),
    ),
  );
  if (
    requested.size !== sources.length ||
    [...requested].some((identity) => !declared.has(identity))
  )
    throw new Error("Tracked package sources must match unique declared artifact releases");
  return selected;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let packagesDirectory = join(repositoryRoot, "packages");
    let tracked = false;
    const args = process.argv.slice(2);
    while (args.length) {
      const argument = args.shift();
      if (argument === "--tracked") tracked = true;
      else if (argument === "--packages-dir" && args[0] && !args[0].startsWith("--"))
        packagesDirectory = args.shift();
      else
        throw new Error("Usage: agents:artifacts [--tracked] [--packages-dir /path/to/packages]");
    }
    let entries = await loadAgentEntries();
    if (tracked)
      entries = trackedAgentEntries(
        entries,
        JSON.parse(
          await readFile(join(repositoryRoot, "scripts/agent-package-sources.json"), "utf8"),
        ),
      );
    const result = await auditAgentArtifacts(entries, packagesDirectory);
    if (result.errors.length) {
      result.errors.forEach((error) => console.error(error));
      process.exitCode = 1;
    } else
      console.log(
        `Checked ${result.declared} ${tracked ? "tracked" : "declared"} agent artifact${result.declared === 1 ? "" : "s"}.`,
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
