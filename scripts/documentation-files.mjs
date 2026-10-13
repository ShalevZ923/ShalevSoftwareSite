import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

const directoryName = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const fileName = /^[A-Za-z0-9][A-Za-z0-9_.-]*\.md$/;
export const documentationRoute =
  /^\/api\/developer\/docs\/((?:[A-Za-z0-9][A-Za-z0-9_.-]*\/)*[A-Za-z0-9][A-Za-z0-9_.-]*\.md)$/;

function notFound() {
  return Object.assign(new Error("Document not found"), {
    statusCode: 404,
    code: "DOCUMENT_NOT_FOUND",
  });
}

/** Resolve an existing regular Markdown file without following any source symlinks. */
export async function documentationFile(root, name) {
  const parts = name.split("/");
  if (!fileName.test(parts.at(-1)) || parts.slice(0, -1).some((part) => !directoryName.test(part)))
    throw notFound();
  let path = root;
  try {
    const rootStats = await lstat(root);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) throw notFound();
    for (const [index, part] of parts.entries()) {
      path = join(path, part);
      const stats = await lstat(path);
      if (
        stats.isSymbolicLink() ||
        (index === parts.length - 1 ? !stats.isFile() : !stats.isDirectory())
      )
        throw notFound();
    }
    return path;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") throw notFound();
    throw error;
  }
}

/** Names are paths relative to docs/, so repeated basenames remain distinct. */
export async function listDocumentationFiles(root) {
  const files = [];
  const rootStats = await lstat(root);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) throw notFound();
  async function visit(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory() && directoryName.test(entry.name))
        await visit(join(directory, entry.name), prefix + entry.name + "/");
      else if (entry.isFile() && fileName.test(entry.name)) {
        const name = prefix + entry.name;
        const stats = await lstat(await documentationFile(root, name));
        files.push({ name, sizeBytes: stats.size, modified: stats.mtime.toISOString() });
      }
    }
  }
  await visit(root);
  return files.sort((left, right) =>
    left.name === "README.md"
      ? -1
      : right.name === "README.md"
        ? 1
        : left.name.localeCompare(right.name),
  );
}
