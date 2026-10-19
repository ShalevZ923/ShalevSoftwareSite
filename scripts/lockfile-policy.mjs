import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

function addVersion(graph, name, version) {
  (graph[name] ??= new Set()).add(version);
}

export function lockfileDifferences(npmLock, pnpmText) {
  const npm = {};
  for (const [path, record] of Object.entries(npmLock.packages)) {
    if (path && record.version)
      addVersion(npm, path.split("node_modules/").at(-1), record.version);
  }
  // Deliberately support the checked-in pnpm v9 layout only; fail on format migration.
  if (!/^lockfileVersion: ['"]9\.0['"]$/m.test(pnpmText))
    throw new Error("Review the lockfile policy parser before changing pnpm lockfile format");
  const packages = pnpmText.split(/^packages:\s*$/m)[1]?.split(/^snapshots:\s*$/m)[0];
  if (!packages) throw new Error("Missing pnpm package records");
  const pnpm = {};
  for (const match of packages.matchAll(/^  (?:'([^']+)'|"([^"]+)"|([^\s]+)):\s*$/gm)) {
    const key = match[1] || match[2] || match[3];
    const at = key.lastIndexOf("@");
    if (at <= 0) throw new Error(`Unsupported pnpm package key: ${key}`);
    addVersion(pnpm, key.slice(0, at), key.slice(at + 1));
  }
  if (!Object.keys(pnpm).length) throw new Error("No pnpm packages parsed");
  const result = {};
  for (const name of [...new Set([...Object.keys(npm), ...Object.keys(pnpm)])].sort()) {
    const versions = { npm: [...(npm[name] || [])].sort(), pnpm: [...(pnpm[name] || [])].sort() };
    if (JSON.stringify(versions.npm) !== JSON.stringify(versions.pnpm)) result[name] = versions;
  }
  return result;
}

export async function checkLockfilePolicy() {
  const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const manifest = JSON.parse(await read("package.json"));
  const npmLock = JSON.parse(await read("package-lock.json"));
  const root = npmLock.packages[""];
  for (const key of ["name", "version", "dependencies", "devDependencies", "engines"])
    if (JSON.stringify(root[key]) !== JSON.stringify(manifest[key]))
      throw new Error(`npm lock root differs from package.json: ${key}`);
  const differences = lockfileDifferences(npmLock, await read("pnpm-lock.yaml"));
  const approved = JSON.parse(await read("config/lockfile-differences.json"));
  if (approved.canonical !== manifest.packageManager)
    throw new Error("Canonical release package manager differs from package.json");
  if (JSON.stringify(differences) !== JSON.stringify(approved.differences))
    throw new Error(
      "Unreviewed npm/pnpm graph drift; inspect both locks and update the policy ledger",
    );
  console.log(
    `Lockfile policy passed: ${Object.keys(differences).length} recorded graph differences`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await checkLockfilePolicy();
