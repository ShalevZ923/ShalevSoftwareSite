import { describe, it, expect, vi } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const fault = vi.hoisted(() => ({ active: false, rollback: false, target: "" }));
vi.mock("node:fs/promises", async (original) => {
  const fs = await original();
  return {
    ...fs,
    rename: async (from, to) => {
      if (fault.active && to === fault.target && from.endsWith(".pending")) {
        fault.rollback = true;
        throw Object.assign(new Error("Injected I/O failure"), { code: "EIO" });
      }
      return fs.rename(from, to);
    },
    open: async (path, ...args) => {
      if (fault.rollback && String(path).includes("a.txt.") && String(path).endsWith(".pending"))
        throw Object.assign(new Error("Rollback storage failure"), { code: "EIO" });
      return fs.open(path, ...args);
    },
  };
});
import {
  publishTransaction,
  recoverTransactions,
  consistentRead,
} from "./mutation-coordinator.mjs";
describe("failed rollback quarantine", () => {
  it("blocks reads until the full transaction recovers", async () => {
    const root = await mkdtemp(join(tmpdir(), "atlas-quarantine-")),
      state = join(root, "state"),
      a = join(root, "a.txt"),
      b = join(root, "b.txt");
    try {
      await writeFile(a, "old a");
      await writeFile(b, "old b");
      fault.target = b;
      fault.active = true;
      await expect(
        publishTransaction(
          [
            { path: a, content: "new a" },
            { path: b, content: "new b" },
          ],
          { stateDirectory: state, roots: [root] },
        ),
      ).rejects.toMatchObject({ code: "RECOVERY_REQUIRED" });
      await expect(consistentRead(() => readFile(a))).rejects.toMatchObject({ statusCode: 503 });
      fault.active = false;
      fault.rollback = false;
      await recoverTransactions(state, [root]);
      expect(await consistentRead(() => readFile(a, "utf8"))).toBe("old a");
      expect(await readFile(b, "utf8")).toBe("old b");
    } finally {
      fault.active = false;
      fault.rollback = false;
      await recoverTransactions(state, [root]);
      await rm(root, { recursive: true, force: true });
    }
  });
});
