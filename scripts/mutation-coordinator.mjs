import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, readFile, rename, rm, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

let pending = Promise.resolve();
const quarantined = new Map();
const recoveryRoots = new Map();
export function coordinateMutation(operation) {
  const result = pending.then(() => {
    if (quarantined.size)
      throw Object.assign(
        new Error(
          "Authoring state requires recovery. Restart the server after resolving the storage error.",
        ),
        { statusCode: 503, code: "RECOVERY_REQUIRED" },
      );
    return operation();
  });
  pending = result.catch(() => {});
  return result;
}
export function consistentRead(operation) {
  return coordinateMutation(operation);
}
export function recordRevision(value) {
  const canonical = (item) =>
    Array.isArray(item)
      ? item.map(canonical)
      : item && typeof item === "object"
        ? Object.fromEntries(
            Object.keys(item)
              .sort()
              .map((key) => [key, canonical(item[key])]),
          )
        : item;
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
export function assertRevision(expected, value) {
  if (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected)) {
    throw Object.assign(new Error("Reload this record before saving; its revision is required."), {
      statusCode: 428,
      code: "REVISION_REQUIRED",
    });
  }
  if (expected !== recordRevision(value)) {
    throw Object.assign(
      new Error(
        "This record changed since you loaded it. Your draft was retained; reload and compare before saving.",
      ),
      { statusCode: 409, code: "REVISION_CONFLICT" },
    );
  }
}
export async function sourceSnapshot(root) {
  const files = [];
  const walk = async (directory) => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (entry.name === ".tool-atlas-state" || /\.[a-f0-9-]{36}\.pending$/.test(entry.name))
        continue;
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Source snapshot cannot follow symbolic links");
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile())
        files.push([
          relative(root, path),
          createHash("sha256")
            .update(await readFile(path))
            .digest("hex"),
        ]);
    }
  };
  await walk(root);
  return recordRevision(files);
}
export async function assertSourceSnapshot(root, expected) {
  if ((await sourceSnapshot(root)) !== expected)
    throw Object.assign(
      new Error(
        "Source files changed while this save was staged. Reload and compare your retained draft.",
      ),
      { statusCode: 409, code: "REVISION_CONFLICT" },
    );
}
function inside(root, target) {
  const path = relative(resolve(root), resolve(target));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}
async function assertTarget(path, roots) {
  const root = roots.find((item) => inside(item, path));
  if (!root) throw new Error("Transaction target escapes its allowed roots");
  let current = resolve(root);
  // Validate roots too: mounted directories may be real, symbolic paths may not.
  for (const part of ["", ...relative(current, resolve(path)).split(sep).filter(Boolean)]) {
    if (part) current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error("Transaction target cannot follow a symbolic link");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}
async function durableWrite(path, content) {
  const handle = await open(path, "w", 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function saveJournal(path, journal) {
  const temporary = path + ".pending";
  await durableWrite(temporary, JSON.stringify(journal));
  await rename(temporary, path);
}
async function restore(journal, roots) {
  for (const item of [...journal.changes].reverse()) {
    await assertTarget(item.path, roots);
    const temporary = item.path + "." + journal.id + ".pending";
    let current = null;
    try {
      current = await readFile(item.path, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (Object.hasOwn(item, "next") && current !== item.previous && current !== item.next)
      throw new Error("Recovery found an external edit; inspect the journal before restoring");
    if (current === item.previous) {
      await rm(temporary, { force: true });
      continue;
    }
    if (item.previous === null) await rm(item.path, { force: true });
    else {
      await mkdir(dirname(item.path), { recursive: true });
      await durableWrite(temporary, item.previous);
      await rename(temporary, item.path);
    }
    await rm(temporary, { force: true });
  }
}
async function recoverPreparedTransactions(stateDirectory, roots) {
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  if ((await lstat(stateDirectory)).isSymbolicLink())
    throw new Error("Transaction state cannot be a symbolic link");
  for (const name of (await readdir(stateDirectory)).sort()) {
    if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
    const path = join(stateDirectory, name);
    const journal = JSON.parse(await readFile(path, "utf8"));
    if (
      journal.version !== 1 ||
      journal.id + ".json" !== name ||
      !Array.isArray(journal.changes) ||
      !["prepared", "committed", "rolled-back"].includes(journal.status)
    )
      throw new Error("Invalid transaction recovery journal");
    if (journal.status !== "prepared") continue;
    for (const item of journal.changes) {
      if (
        typeof item.path !== "string" ||
        (item.previous !== null && typeof item.previous !== "string")
      )
        throw new Error("Invalid transaction recovery entry");
      await assertTarget(item.path, roots);
    }
    await restore(journal, roots);
    journal.status = "rolled-back";
    await saveJournal(path, journal);
  }
}
export async function recoverTransactions(stateDirectory, roots) {
  const trusted = [...new Set([...(recoveryRoots.get(stateDirectory) ?? []), ...roots])];
  recoveryRoots.set(stateDirectory, trusted);
  try {
    await recoverPreparedTransactions(stateDirectory, trusted);
    quarantined.delete(stateDirectory);
  } catch (error) {
    quarantined.set(stateDirectory, error);
    throw Object.assign(
      new Error("Recovery failed; authoring remains quarantined: " + error.message),
      { statusCode: 503, code: "RECOVERY_REQUIRED" },
    );
  }
}
/** A durable undo journal covers source, deletions and generated files as one operation. */
/** @param {{path:string,content:string|null}[]} changes
 * @param {{stateDirectory:string,roots:string[],precondition?:()=>Promise<void>}} options */
export async function publishTransaction(changes, { stateDirectory, roots, precondition }) {
  await recoverTransactions(stateDirectory, roots);
  if (precondition) await precondition();
  let beganPublishing = false;
  const journal = { version: 1, id: randomUUID(), status: "prepared", changes: [] };
  for (const { path, content } of changes) {
    await assertTarget(path, roots);
    let previous = null;
    try {
      if (!(await lstat(path)).isFile())
        throw new Error("Transaction target must be a regular file");
      previous = await readFile(path, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    journal.changes.push({ path: resolve(path), previous, next: content });
  }
  const path = join(stateDirectory, journal.id + ".json");
  await saveJournal(path, journal);
  try {
    for (const change of changes) {
      await mkdir(dirname(change.path), { recursive: true });
      if (change.content !== null)
        await durableWrite(change.path + "." + journal.id + ".pending", change.content);
    }
    if (precondition) await precondition();
    for (const change of journal.changes) {
      let current = null;
      try {
        current = await readFile(change.path, "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (current !== change.previous)
        throw Object.assign(new Error("The source changed during staging. Reload before saving."), {
          statusCode: 409,
          code: "REVISION_CONFLICT",
        });
    }
    beganPublishing = true;
    for (const change of changes) {
      if (change.content === null) await rm(change.path, { force: true });
      else await rename(change.path + "." + journal.id + ".pending", change.path);
    }
    journal.status = "committed";
    await saveJournal(path, journal);
  } catch (error) {
    // Restore even writes whose rename completed before a process interruption.
    try {
      if (beganPublishing) await restore(journal, recoveryRoots.get(stateDirectory) ?? roots);
    } catch (recoveryError) {
      quarantined.set(stateDirectory, recoveryError);
      throw Object.assign(new Error("Rollback failed; authoring requires recovery"), {
        statusCode: 503,
        code: "RECOVERY_REQUIRED",
      });
    }
    journal.status = "rolled-back";
    await saveJournal(path, journal);
    throw error;
  } finally {
    for (const change of changes)
      await rm(change.path + "." + journal.id + ".pending", { force: true });
  }
}
