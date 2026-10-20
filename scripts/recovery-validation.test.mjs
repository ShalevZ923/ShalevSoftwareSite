import { describe, it, expect } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  recoverTransactions,
  consistentRead,
  publishTransaction,
} from "./mutation-coordinator.mjs";
const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const otherId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const cases = [
  [
    "missing next",
    (j) => {
      delete j.changes[1].next;
    },
  ],
  [
    "non-text next",
    (j) => {
      j.changes[1].next = {};
    },
  ],
  [
    "missing previous",
    (j) => {
      delete j.changes[1].previous;
    },
  ],
  [
    "non-text previous",
    (j) => {
      j.changes[1].previous = 42;
    },
  ],
  [
    "null entry",
    (j) => {
      j.changes[1] = null;
    },
  ],
  [
    "relative target",
    (j) => {
      j.changes[1].path = "relative.txt";
    },
  ],
  [
    "duplicate normalized target",
    (j) => {
      j.changes[1].path = join(j.changes[0].path, "..", "a.txt");
    },
  ],
  [
    "wrong version",
    (j) => {
      j.version = 2;
    },
  ],
  [
    "wrong filename identity",
    (j) => {
      j.id = otherId;
    },
  ],
  [
    "unknown status",
    (j) => {
      j.status = "unknown";
    },
  ],
  [
    "non-array changes",
    (j) => {
      j.changes = {};
    },
  ],
];
describe("malformed recovery state preserves all bytes", () => {
  it.each(cases)("rejects %s before restoring any entry", async (_name, mutate) => {
    const root = await mkdtemp(join(tmpdir(), "atlas-invalid-recovery-"));
    const state = join(root, "state"),
      a = join(root, "a.txt"),
      b = join(root, "b.txt");
    const path = join(state, id + ".json");
    try {
      await mkdir(state);
      await writeFile(a, "new a");
      await writeFile(b, "external edit");
      const journal = {
        version: 1,
        id,
        status: "prepared",
        changes: [
          { path: a, previous: "old a", next: "new a" },
          { path: b, previous: "old b", next: "new b" },
        ],
      };
      mutate(journal);
      const bytes = JSON.stringify(journal);
      await writeFile(path, bytes);
      await expect(recoverTransactions(state, [root])).rejects.toMatchObject({
        code: "RECOVERY_REQUIRED",
        statusCode: 503,
      });
      expect(await readFile(a, "utf8")).toBe("new a");
      expect(await readFile(b, "utf8")).toBe("external edit");
      expect(await readFile(path, "utf8")).toBe(bytes);
      await expect(consistentRead(() => "unsafe")).rejects.toMatchObject({
        code: "RECOVERY_REQUIRED",
      });
    } finally {
      await rm(path, { force: true });
      await recoverTransactions(state, [root]);
      await rm(root, { recursive: true, force: true });
    }
  });
  it.each(["null", "[]", "{"])(
    "rejects malformed top-level JSON %s without a restore",
    async (bytes) => {
      const root = await mkdtemp(join(tmpdir(), "atlas-invalid-json-")),
        state = join(root, "state");
      const path = join(state, id + ".json");
      try {
        await mkdir(state);
        await writeFile(path, bytes);
        await expect(recoverTransactions(state, [root])).rejects.toMatchObject({
          code: "RECOVERY_REQUIRED",
        });
        expect(await readFile(path, "utf8")).toBe(bytes);
      } finally {
        await rm(path, { force: true });
        await recoverTransactions(state, [root]);
        await rm(root, { recursive: true, force: true });
      }
    },
  );
  it.each(["malformed later journal", "external later edit", "duplicate later target"])(
    "preflights every journal before restoring: %s",
    async (problem) => {
      const root = await mkdtemp(join(tmpdir(), "atlas-recovery-preflight-")),
        state = join(root, "state");
      const a = join(root, "a.txt"),
        b = join(root, "b.txt");
      try {
        await mkdir(state);
        await writeFile(a, "new a");
        await writeFile(b, "external edit");
        await writeFile(
          join(state, id + ".json"),
          JSON.stringify({
            version: 1,
            id,
            status: "prepared",
            changes: [{ path: a, previous: "old a", next: "new a" }],
          }),
        );
        const later = {
          version: 1,
          id: otherId,
          status: "prepared",
          changes: [{ path: b, previous: "old b", next: "new b" }],
        };
        if (problem === "malformed later journal") delete later.changes[0].next;
        if (problem === "duplicate later target")
          later.changes[0] = { path: a, previous: "old a", next: "new a" };
        await writeFile(join(state, otherId + ".json"), JSON.stringify(later));
        await expect(recoverTransactions(state, [root])).rejects.toMatchObject({
          code: "RECOVERY_REQUIRED",
        });
        expect(await readFile(a, "utf8")).toBe("new a");
        expect(await readFile(b, "utf8")).toBe("external edit");
      } finally {
        await rm(state, { recursive: true, force: true });
        await recoverTransactions(state, [root]);
        await rm(root, { recursive: true, force: true });
      }
    },
  );
  it.runIf(process.platform !== "win32")(
    "rejects linked journals and targets before restoring",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "atlas-linked-recovery-")),
        state = join(root, "state");
      const source = join(root, "source.txt"),
        target = join(root, "linked.txt"),
        path = join(state, id + ".json");
      try {
        await mkdir(state);
        await writeFile(source, "protected bytes");
        await symlink(source, target);
        await writeFile(
          path,
          JSON.stringify({
            version: 1,
            id,
            status: "prepared",
            changes: [{ path: target, previous: "old", next: "protected bytes" }],
          }),
        );
        await expect(recoverTransactions(state, [root])).rejects.toThrow(/symbolic link/);
        await rm(path);
        await symlink(source, path);
        await expect(recoverTransactions(state, [root])).rejects.toThrow(/regular file/);
        expect(await readFile(source, "utf8")).toBe("protected bytes");
      } finally {
        await rm(path, { force: true });
        await recoverTransactions(state, [root]);
        await rm(root, { recursive: true, force: true });
      }
    },
  );
  it("retains settled journals from a different authoring root without reopening them", async () => {
    const root = await mkdtemp(join(tmpdir(), "atlas-settled-history-"));
    const state = join(root, "state"),
      docs = join(root, "docs"),
      catalog = join(root, "catalog");
    try {
      await mkdir(docs);
      await mkdir(catalog);
      const doc = join(docs, "README.md"),
        source = join(catalog, "tool.json");
      await publishTransaction([{ path: doc, content: "saved document" }], {
        stateDirectory: state,
        roots: [docs],
      });
      // A fresh process has no remembered root union.
      const { recoverTransactions: freshRecovery } =
        await import("./mutation-coordinator.mjs?settled-history");
      await freshRecovery(state, [catalog]);
      await publishTransaction([{ path: source, content: "saved source" }], {
        stateDirectory: state,
        roots: [catalog],
      });
      expect(await readFile(doc, "utf8")).toBe("saved document");
      expect(await readFile(source, "utf8")).toBe("saved source");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
