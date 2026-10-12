import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  publishTransaction,
  recoverTransactions,
  recordRevision,
  assertRevision,
} from "./mutation-coordinator.mjs";
describe("durable transaction recovery", () => {
  it("recovers an interrupted multi-file update and is idempotent", async () => {
    const root = await mkdtemp(join(tmpdir(), "atlas-recovery-"));
    try {
      const state = join(root, "state");
      await mkdir(state);
      const a = join(root, "a.txt"),
        b = join(root, "b.txt");
      await writeFile(a, "partially committed");
      await writeFile(b, "new file");
      const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      await writeFile(
        join(state, id + ".json"),
        JSON.stringify({
          version: 1,
          id,
          status: "prepared",
          changes: [
            { path: a, previous: "original" },
            { path: b, previous: null },
          ],
        }),
      );
      await recoverTransactions(state, [root]);
      await recoverTransactions(state, [root]);
      expect(await readFile(a, "utf8")).toBe("original");
      await expect(readFile(b)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("retains committed undo bytes and does not roll successful saves back", async () => {
    const root = await mkdtemp(join(tmpdir(), "atlas-journal-"));
    try {
      const path = join(root, "source.txt"),
        state = join(root, "state");
      await writeFile(path, "old");
      await publishTransaction([{ path, content: "new" }], {
        stateDirectory: state,
        roots: [root],
      });
      await recoverTransactions(state, [root]);
      expect(await readFile(path, "utf8")).toBe("new");
      const journal = JSON.parse(await readFile(join(state, (await readdir(state))[0]), "utf8"));
      expect(journal.status).toBe("committed");
      expect(journal.changes[0].previous).toBe("old");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("rejects missing and stale revisions without depending on object key order", () => {
    const value = { metadata: { id: "one", name: "One" }, guide: "guide" };
    expect(recordRevision(value)).toBe(
      recordRevision({ guide: "guide", metadata: { name: "One", id: "one" } }),
    );
    expect(() => assertRevision(undefined, value)).toThrow(/revision/);
    expect(() => assertRevision(recordRevision(value), { ...value, guide: "new" })).toThrow(
      /changed/,
    );
  });
  it("refuses an out-of-root recovery journal", async () => {
    const root = await mkdtemp(join(tmpdir(), "atlas-bad-journal-"));
    try {
      const state = join(root, "state");
      await mkdir(state);
      const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      await writeFile(
        join(state, id + ".json"),
        JSON.stringify({
          version: 1,
          id,
          status: "prepared",
          changes: [{ path: join(root, "..", "outside.txt"), previous: null }],
        }),
      );
      await expect(recoverTransactions(state, [root])).rejects.toThrow(/allowed roots/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
