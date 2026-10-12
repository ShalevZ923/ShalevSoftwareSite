import { assertRevision, coordinateMutation, publishTransaction } from "./mutation-coordinator.mjs";
import { stableMachineCatalog } from "./catalog-content.mjs";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  contentDirectory,
  generatedCatalogPath,
  machineCatalogIndexPath,
  machineCatalogToolsPath,
  loadCatalogEntries,
  loadTaxonomy,
  renderCatalogEntryFiles,
  renderGeneratedCatalog,
  renderMachineCatalog,
} from "./catalog-content.mjs";

function inside(root, path) {
  const rel = relative(root, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
async function assertSourcePath(root, target) {
  if (!inside(root, target)) throw new Error("Catalog path escapes source root");
  let current = root;
  for (const segment of relative(root, target).split(sep).filter(Boolean)) {
    current = join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error("Catalog mutation cannot follow symlinks");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

export function saveCatalogEntry(
  metadata,
  guide,
  {
    directory = contentDirectory,
    generatedPath = generatedCatalogPath,
    indexPath = machineCatalogIndexPath,
    toolsPath = machineCatalogToolsPath,
    create = false,
    revision,
    stateDirectory = join(dirname(directory), ".tool-atlas-state"),
  } = {},
) {
  return coordinateMutation(async () => {
    const categories = await loadTaxonomy();
    const category = categories.find((item) => item.label === metadata.category);
    if (!category) throw new Error(`Unknown catalog category: ${metadata.category}`);
    const root = await realpath(directory);
    const entries = await loadCatalogEntries(root);
    const existing = entries.find((entry) => entry.metadata.id === metadata.id);
    if (existing && !create) assertRevision(revision, existing);
    if (create && existing) throw new Error(`Tool ${metadata.id} already exists`);
    if (!create && !existing) throw new Error(`Tool ${metadata.id} not found`);
    if (
      existing &&
      (existing.metadata.company !== metadata.company ||
        existing.metadata.category !== metadata.category)
    ) {
      throw new Error(
        "metadata.company and metadata.category cannot be changed through Developer Studio",
      );
    }
    if (!metadata.order)
      metadata.order =
        existing?.metadata.order ?? Math.max(...entries.map((entry) => entry.metadata.order)) + 1;
    const { directory: entryDirectory, files } = renderCatalogEntryFiles(
      metadata,
      guide,
      category.id,
      root,
    );
    for (const file of files) await assertSourcePath(root, file.path);
    try {
      const vendor = JSON.parse(await readFile(files[0].path, "utf8"));
      if (vendor.name !== metadata.company)
        throw new Error("Vendor directory belongs to another company");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const releasesDirectory = join(entryDirectory, "releases");
    const obsolete = [];
    try {
      for (const entry of await readdir(releasesDirectory, { withFileTypes: true })) {
        const path = join(releasesDirectory, entry.name);
        if (entry.name.endsWith(".json") && !files.some((file) => file.path === path)) {
          await assertSourcePath(root, path);
          if (!entry.isFile()) throw new Error("Release metadata must be a regular file");
          obsolete.push({ path, content: null });
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const stage = await mkdtemp(join(tmpdir(), "tool-atlas-save-"));
    try {
      const stagedRoot = join(stage, "catalog");
      await cp(root, stagedRoot, { recursive: true });
      for (const file of files) {
        const path = join(stagedRoot, relative(root, file.path));
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, file.content, "utf8");
      }
      for (const file of obsolete) await rm(join(stagedRoot, relative(root, file.path)));
      const accepted = await loadCatalogEntries(stagedRoot);
      const feed = await stableMachineCatalog(accepted, { indexPath, toolsPath });
      await publishTransaction(
        [
          ...files,
          ...obsolete,
          { path: generatedPath, content: renderGeneratedCatalog(accepted) },
          { path: indexPath, content: feed.index },
          { path: toolsPath, content: feed.tools },
        ],
        {
          stateDirectory,
          roots: [root, dirname(generatedPath), dirname(indexPath), dirname(toolsPath)],
        },
      );
      return accepted.find((entry) => entry.metadata.id === metadata.id);
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  });
}
