import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { auditAgentArtifacts } from "./check-agent-artifacts.mjs";

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(files, method = 0) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [filename, text] of Object.entries(files)) {
    const name = Buffer.from(filename);
    const body = Buffer.from(text);
    const packed = method === 8 ? deflateRawSync(body) : body;
    const checksum = crc32(body);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x800, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(packed.length, 18);
    localHeader.writeUInt32LE(body.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE((3 << 8) | 20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(packed.length, 20);
    centralHeader.writeUInt32LE(body.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE((0x81a4 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    local.push(localHeader, name, packed);
    central.push(centralHeader, name);
    offset += localHeader.length + name.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

describe("agent artifact audit", () => {
  it("verifies complete staged ZIPs, detects hash changes, and rejects symlink escape", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-artifact-audit-"));
    try {
      const packageRoot = join(root, "packages");
      const releaseDir = join(packageRoot, "test-skill", "1.0");
      await mkdir(releaseDir, { recursive: true });
      const bytes = storedZip({ "test-skill/SKILL.md": "# Test", "test-skill/scripts/run.py": "print('ok')" }, 8);
      const digest = createHash("sha256").update(bytes).digest("hex");
      const pointer = "test-skill/1.0/test-skill-1.0.zip";
      const path = join(releaseDir, "test-skill-1.0.zip");
      await writeFile(path, bytes);
      const entries = [{ metadata: { id: "test-skill", releases: [{ version: "1.0", artifact: pointer, sha256: digest, archiveRoot: "test-skill", contents: [{ path: "SKILL.md" }, { path: "scripts" }] }] } }];
      expect(await auditAgentArtifacts(entries, packageRoot)).toEqual({ declared: 1, errors: [] });
      await writeFile(path, "changed");
      expect((await auditAgentArtifacts(entries, packageRoot)).errors[0]).toContain("does not match");
      await rm(path);
      const outside = join(root, "outside.zip");
      await writeFile(outside, bytes);
      await symlink(outside, path);
      expect((await auditAgentArtifacts(entries, packageRoot)).errors[0]).toContain("escapes");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects non-ZIP bytes, traversal paths, and files absent from the contents list", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-zip-check-"));
    try {
      const packageRoot = join(root, "packages");
      const releaseDir = join(packageRoot, "test-skill", "1.0");
      await mkdir(releaseDir, { recursive: true });
      const path = join(releaseDir, "test-skill-1.0.zip");
      const entries = [{ metadata: { id: "test-skill", releases: [{ version: "1.0", artifact: "test-skill/1.0/test-skill-1.0.zip", archiveRoot: "test-skill", sha256: "", contents: [{ path: "SKILL.md" }] }] } }];
      const corrupt = storedZip({ "test-skill/SKILL.md": "good" });
      corrupt[corrupt.indexOf(Buffer.from("good"))] ^= 1;
      const symlink = storedZip({ "test-skill/SKILL.md": "good" });
      symlink.writeUInt32LE((0xa1ff << 16) >>> 0, symlink.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 38);
      for (const [bytes, expected] of [
        [Buffer.from("not a ZIP"), "ZIP size"],
        [storedZip({ "test-skill/../SKILL.md": "bad" }), "unsafe ZIP entry path"],
        [storedZip({ "other/SKILL.md": "bad" }), "outside test-skill/"],
        [storedZip({ "test-skill/SKILL.md": "a", "test-skill/skill.md": "b" }), "duplicate ZIP entry"],
        [storedZip({ "test-skill/SKILL.md": "good", "test-skill/extra.sh": "bad" }), "unlisted ZIP file"],
        [storedZip({ "test-skill/README.md": "wrong" }), "listed content is missing"],
        [corrupt, "ZIP entry is corrupt"],
        [symlink, "unsupported ZIP entry"],
      ]) {
        await writeFile(path, bytes);
        entries[0].metadata.releases[0].sha256 = createHash("sha256").update(bytes).digest("hex");
        expect((await auditAgentArtifacts(entries, packageRoot)).errors[0]).toContain(expected);
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
