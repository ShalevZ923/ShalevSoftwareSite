#!/usr/bin/env python3
"""Build reproducible, reviewed evaluation ZIPs from tracked source snapshots."""

import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "scripts/agent-package-sources.json"
FIXED_DATE = (2026, 9, 24, 0, 0, 0)


def safe_relative(value: str) -> PurePosixPath:
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or "\\" in value:
        raise ValueError(f"Unsafe package path: {value}")
    return path


def package_files(spec: dict) -> dict[str, Path]:
    files: dict[str, Path] = {}
    for source in spec["sources"]:
        directory = ROOT / safe_relative(source["directory"])
        destination = safe_relative(source["destination"])
        if not directory.is_dir() or directory.is_symlink():
            raise ValueError(f"Missing or linked source directory: {directory}")
        for path in directory.rglob("*"):
            if path.is_symlink():
                raise ValueError(f"Package source contains a symlink: {path}")
            if not path.is_file():
                continue
            entry = str(destination / PurePosixPath(path.relative_to(directory).as_posix()))
            if entry in files:
                raise ValueError(f"Duplicate archive entry: {entry}")
            files[entry] = path
    if not files:
        raise ValueError(f"No files for {spec['id']}")
    return files


def build(spec: dict) -> str | None:
    identifier, version, archive_root = spec["id"], spec["version"], spec["archiveRoot"]
    if any("/" in item or "\\" in item or item in (".", "..") for item in (identifier, version, archive_root)):
        raise ValueError(f"Invalid package identity: {identifier}")
    files = package_files(spec)
    destination = ROOT / "packages" / identifier / version / f"{identifier}-{version}.zip"
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_STORED) as archive:
        for name, path in sorted(files.items()):
            info = zipfile.ZipInfo(f"{archive_root}/{name}", FIXED_DATE)
            info.compress_type = zipfile.ZIP_STORED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    records = list((ROOT / "content/agents").glob(f"**/{identifier}/releases/{version}.json"))
    if len(records) > 1:
        raise ValueError(f"Ambiguous release record: {identifier}@{version}")
    if records:
        recorded = json.loads(records[0].read_text())["sha256"]
        if digest != recorded:
            return f"{identifier}@{version}: ZIP checksum differs from release record ({digest})"
    print(f"{identifier}@{version} {digest} {destination}")
    return None


if __name__ == "__main__":
    specs = json.loads(MANIFEST.read_text())
    errors = [error for spec in specs if (error := build(spec))]
    if errors:
        sys.exit("\n".join(errors))
