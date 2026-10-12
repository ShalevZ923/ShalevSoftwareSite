import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
if (Number(process.versions.node.split(".")[0]) !== 24)
  throw new Error("Tool Atlas requires Node 24; detected " + process.version);
await access(new URL("../content/taxonomy/categories.json", import.meta.url));
console.log(
  "Node",
  process.version,
  "; package",
  packageJson.version,
  "; npm and pnpm workflows supported",
);
if (packageJson.scripts["agents:packages"]) {
  try {
    console.log(execFileSync("python3", ["--version"], { encoding: "utf8" }).trim());
  } catch {
    throw new Error("Python 3 is required to build agent ZIPs");
  }
}
console.log("Preflight passed. Run catalog:check to check generated content freshness.");
