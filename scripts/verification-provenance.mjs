import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkLockfilePolicy } from "./lockfile-policy.mjs";

const targets = [
  "src/generated/catalog.ts",
  "public/catalog/v1/index.json",
  "public/catalog/v1/tools.json",
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function verifyEvidence(records) {
  const expected = new Set();
  for (const os of ["ubuntu-latest", "windows-latest"])
    for (const manager of ["npm", "pnpm"])
      for (const node of ["24.11.0", "24"]) expected.add(`${os}/${manager}/${node}`);
  const first = records[0];
  if (!first?.revision) throw new Error("Missing source revision");
  for (const record of records) {
    const key = `${record.os}/${record.manager}/${record.nodeSelector}`;
    if (!expected.delete(key)) throw new Error(`Duplicate or unexpected evidence: ${key}`);
    for (const path of ["package-lock.json", "pnpm-lock.yaml"])
      if (!/^[a-f0-9]{64}$/.test(record.locks?.[path] || ""))
        throw new Error(`Missing dependency hash: ${key}/${path}`);
    for (const path of targets)
      if (!/^[a-f0-9]{64}$/.test(record.generated?.[path] || ""))
        throw new Error(`Missing generated hash: ${key}/${path}`);
    if (record.revision !== first.revision) throw new Error("Evidence mixes source revisions");
    if (JSON.stringify(record.locks) !== JSON.stringify(first.locks))
      throw new Error("Evidence mixes dependency locks");
    if (JSON.stringify(record.generated) !== JSON.stringify(first.generated))
      throw new Error(`Generated catalog parity failed: ${key}`);
    if (!/^[a-f0-9]{64}$/.test(record.markdown || "") || record.markdown !== first.markdown)
      throw new Error(`Markdown rendering parity failed: ${key}`);
  }
  if (expected.size) throw new Error(`Missing acceptance evidence: ${[...expected].join(", ")}`);
}

async function evidenceFiles(directory) {
  const records = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) records.push(...(await evidenceFiles(path)));
    else if (entry.name === "provenance.json")
      records.push(JSON.parse(await readFile(path, "utf8")));
  }
  return records;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--compare") {
    const records = await evidenceFiles(process.argv[3]);
    verifyEvidence(records);
    console.log(`Generated catalog parity passed across ${records.length} fresh acceptance graphs`);
  } else {
    await checkLockfilePolicy();
    const locks = {};
    const generated = {};
    for (const path of ["package-lock.json", "pnpm-lock.yaml"])
      locks[path] = hash(await readFile(path));
    for (const path of targets) generated[path] = hash(await readFile(path));
    const [
      { createElement },
      { renderToStaticMarkup },
      { default: ReactMarkdown },
      { default: gfm },
    ] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("react-markdown"),
      import("remark-gfm"),
    ]);
    const corpus = [
      "# Guide\n\nA paragraph with **bold**, _emphasis_ and ~~removed~~ text.",
      "| Tool | Status |\n| --- | --- |\n| Atlas | Ready |",
      "- [x] Verified\n- [ ] Pending\n\n1. Install\n2. Run",
      "```sh\nnpm ci && npm run verify\n```\n\nhttps://example.com/docs",
      "[Guide](https://example.com/docs)\n\n<script>alert(1)</script>",
    ].join("\n\n");
    const markdown = hash(
      renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [gfm] }, corpus)),
    );
    const evidence = {
      revision: process.env.GITHUB_SHA,
      os: process.env.VERIFY_OS,
      manager: process.env.VERIFY_MANAGER,
      nodeSelector: process.env.VERIFY_NODE,
      node: process.version,
      packageManager: process.env.npm_config_user_agent || process.env.VERIFY_MANAGER,
      locks,
      generated,
      markdown,
    };
    const output = process.argv[2] || ".internal-generated/provenance.json";
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
  }
}
