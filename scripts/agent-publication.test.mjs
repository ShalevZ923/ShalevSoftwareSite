import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDownloadableZip } from "./agent-publication.mjs";
import { parsePublicationOptions } from "./publish-agent-packages.mjs";

describe("ZIP download eligibility", () => {
  const artifact = "tool/1.0/tool.zip";
  const software = [{ metadata: { releases: [{ artifact }] } }];
  const agent = [{ metadata: { status: "deprecated", releases: [{ artifact }] } }];

  it("allows referenced software ZIPs and denies unlisted ZIPs", () => {
    expect(isDownloadableZip(artifact, [], software)).toBe(true);
    expect(isDownloadableZip("tool/1.0/other.zip", [], software)).toBe(false);
  });

  it("does not let software metadata bypass a conflicting agent gate", () => {
    expect(isDownloadableZip(artifact, agent, software)).toBe(false);
    expect(isDownloadableZip(artifact, agent, [])).toBe(false);
  });
});

describe("publication command arguments", () => {
  it("accepts both supported separators and rejects incomplete, repeated, or unknown options", () => {
    const expected = { sourceDirectory: "source", destinationDirectory: "destination" };
    expect(parsePublicationOptions(["--source", "source", "--dest", "destination"])).toEqual(
      expected,
    );
    expect(parsePublicationOptions(["--", "--source", "source", "--dest", "destination"])).toEqual(
      expected,
    );
    for (const args of [
      ["--dest"],
      ["--source", "--dest", "target"],
      ["--unknown", "x"],
      ["--source", "a", "--source", "b"],
    ]) {
      expect(() => parsePublicationOptions(args)).toThrow("Usage:");
    }
  });

  it("rejects a missing destination before changing files", async () => {
    const root = await mkdtemp(join(tmpdir(), "atlas-publish-args-"));
    try {
      const sentinel = join(root, "keep.zip");
      await writeFile(sentinel, "keep");
      const script = fileURLToPath(new URL("./publish-agent-packages.mjs", import.meta.url));
      const result = spawnSync(process.execPath, [script, "--source", root, "--dest"], {
        encoding: "utf8",
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("Usage:");
      expect(await readFile(sentinel, "utf8")).toBe("keep");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
