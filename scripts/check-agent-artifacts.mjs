import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
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
  const declared = entries.flatMap(({ metadata }) => metadata.releases.filter((release) => release.artifact).map((release) => ({ id: metadata.id, ...release })));
  const errors = [];
  if (declared.length === 0) return { declared: 0, errors };
  let root;
  try { root = await realpath(packagesDirectory); }
  catch { return { declared: declared.length, errors: [`Package directory does not exist: ${packagesDirectory}`] }; }
  for (const release of declared) {
    const label = `${release.id}@${release.version}`;
    try {
      const path = await realpath(join(root, release.artifact));
      if (!isInside(root, path)) throw new Error("artifact escapes package directory");
      if (!(await stat(path)).isFile()) throw new Error("artifact is not a regular file");
      const digest = createHash("sha256");
      for await (const chunk of createReadStream(path)) digest.update(chunk);
      if (digest.digest("hex") !== release.sha256) throw new Error("SHA-256 does not match release metadata");
      await inspectAgentZip(path, release.archiveRoot, release.contents);
    } catch (error) { errors.push(`${label}: ${error.message}`); }
  }
  return { declared: declared.length, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = process.argv[2];
  if (argument && argument !== "--packages-dir") {
    console.error("Usage: pnpm agents:artifacts --packages-dir /path/to/packages");
    process.exitCode = 2;
  } else {
    const packagesDirectory = argument ? process.argv[3] : join(repositoryRoot, "packages");
    if (!packagesDirectory) { console.error("Missing --packages-dir value"); process.exitCode = 2; }
    else {
      const result = await auditAgentArtifacts(await loadAgentEntries(), packagesDirectory);
      if (result.errors.length) { result.errors.forEach((error) => console.error(error)); process.exitCode = 1; }
      else console.log(`Checked ${result.declared} declared agent artifact${result.declared === 1 ? "" : "s"}.`);
    }
  }
}
