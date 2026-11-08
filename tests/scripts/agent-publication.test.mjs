import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDownloadableZip } from "../../scripts/agent-publication.mjs";
import { parsePublicationOptions, publishAgentPackages } from "../../scripts/publish-agent-packages.mjs";


describe("ZIP download eligibility", () => {
  const artifact = "tool/1.0/tool.zip";
  const software = [{ metadata: { releases: [{ artifact }] } }];
  const agent = [{ metadata: { status: "deprecated", releases: [{ artifact }] } }];

  it("allows referenced software ZIPs and denies unlisted ZIPs", () => {
    expect(isDownloadableZip(artifact, [], software)).toBe(true);
    expect(isDownloadableZip("tool/1.0/other.zip", [], software)).toBe(false);
  });

  it("allows case-insensitive matches for software and agents", () => {
    expect(isDownloadableZip("tool/1.0/TOOL.ZIP", [], software)).toBe(true);
    expect(isDownloadableZip("TOOL/1.0/tool.zip", [], software)).toBe(true);
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
      const script = fileURLToPath(new URL("../../scripts/publish-agent-packages.mjs", import.meta.url));

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

  it("copies declared software artifacts alongside allowed agent packages to destination", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "atlas-publish-src-"));
    const destDir = await mkdtemp(join(tmpdir(), "atlas-publish-dst-"));
    try {
      const softwareArtifact = "debuggers/1.0.0/jq.zip";
      await mkdir(join(sourceDir, "debuggers", "1.0.0"), { recursive: true });
      await writeFile(join(sourceDir, softwareArtifact), "binary");

      await publishAgentPackages({
        entries: [],
        softwareEntries: [{ metadata: { releases: [{ artifact: softwareArtifact }] } }],
        sourceDirectory: sourceDir,
        destinationDirectory: destDir,
      });

      expect(existsSync(join(destDir, softwareArtifact))).toBe(true);
      expect(await readFile(join(destDir, softwareArtifact), "utf8")).toBe("binary");
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
      await rm(destDir, { recursive: true, force: true });
    }
  });
});

