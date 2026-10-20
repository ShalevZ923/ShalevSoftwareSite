import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
describe("portable tracked archive metadata", () => {
  it("produces identical reviewed ZIP bytes for Unix and Windows defaults", async () => {
    const script = `
import importlib.util, pathlib, tempfile, sys, zipfile
spec = importlib.util.spec_from_file_location('builder', ${JSON.stringify(fileURLToPath(new URL("./build-agent-packages.py", import.meta.url)))})
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
with tempfile.TemporaryDirectory(prefix='atlas zip portability ') as directory:
    builder.ROOT = pathlib.Path(directory)
    source = builder.ROOT / 'vendor' / 'fixture'
    source.mkdir(parents=True)
    (source / 'SKILL.md').write_bytes(b'# Fixture\\n')
    package = {'id':'fixture','version':'1','archiveRoot':'fixture','sources':[{'directory':'vendor/fixture','destination':''}]}
    destination = builder.ROOT / 'packages' / 'fixture' / '1' / 'fixture-1.zip'
    original = sys.platform
    try:
        sys.platform = 'linux'
        assert builder.build(package) is None
        linux_bytes = destination.read_bytes()
        sys.platform = 'win32'
        assert builder.build(package) is None
        assert destination.read_bytes() == linux_bytes
        with zipfile.ZipFile(destination) as archive:
            assert all(item.create_system == 3 for item in archive.infolist())
    finally:
        sys.platform = original
print('Portable archive bytes verified')
`;
    const result = await promisify(execFile)("python3", ["-c", script]);
    expect(result.stdout).toContain("Portable archive bytes verified");
  });
});
