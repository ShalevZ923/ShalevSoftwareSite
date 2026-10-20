import { readdir, readFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = [];
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.isDirectory()) await walk(join(directory, item.name));
    else if (item.isFile() && item.name.endsWith(".md")) files.push(join(directory, item.name));
  }
}
await walk(join(root, "docs"));
for (const item of await readdir(root, { withFileTypes: true }))
  if (item.isFile() && item.name.endsWith(".md")) files.push(join(root, item.name));
for (const name of [
  "content/catalog/README.md",
  "content/agents/README.md",
  "public/catalog/README.md",
]) {
  try {
    await access(join(root, name));
    files.push(join(root, name));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const errors = [];
let checked = 0;
for (const file of files) {
  const content = (await readFile(file, "utf8")).replace(/```[\s\S]*?```/g, "");
  const links = [...content.matchAll(/!?\[[^\]\n]+\]\(([^)\n]+)\)/g)].map((match) => match[1]);
  links.push(...[...content.matchAll(/^\s*\[[^\]^\n]+\]:\s*(\S+)/gm)].map((match) => match[1]));
  for (let target of links) {
    target = target.replace(/\s+["'][^"']*["']$/, "").replace(/^<|>$/g, "");
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(target)) continue;
    const path = decodeURIComponent(target.split(/[?#]/)[0]);
    if (!path) continue;
    checked++;
    try {
      await access(resolve(dirname(file), path));
    } catch {
      errors.push(`${file.slice(root.length + 1)}: ${target}`);
    }
  }
}
// Review records can refer to a repository document as plain text rather than a Markdown link.
const repositoryDocReference = /(?:^|[\s"'(;])((?:docs\/)[A-Za-z0-9_./-]+\.md)/g;
const sources = files.map((file) => ({ file, content: null }));
async function collectRecords(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.isDirectory()) await collectRecords(join(directory, item.name));
    else if (item.isFile() && item.name.endsWith(".json"))
      sources.push({ file: join(directory, item.name), content: null });
  }
}
try {
  await access(join(root, "content/agents"));
  await collectRecords(join(root, "content/agents"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
for (const { file } of sources) {
  const content = (await readFile(file, "utf8")).replace(/```[\s\S]*?```/g, "");
  for (const match of content.matchAll(repositoryDocReference)) {
    checked++;
    try {
      await access(join(root, match[1]));
    } catch {
      errors.push(`${file.slice(root.length + 1)}: ${match[1]}`);
    }
  }
}
if (errors.length) {
  console.error("Broken local documentation links:\n" + errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Documentation links verified: ${checked} local targets across ${files.length} first-party Markdown files.`,
  );
