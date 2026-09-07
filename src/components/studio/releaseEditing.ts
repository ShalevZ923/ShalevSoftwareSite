import type { ToolRelease } from "../../data";

export type ReleaseSource = "url" | "server-file";

export function getReleaseSource(release: ToolRelease): ReleaseSource {
  return typeof release.artifact === "string" ? "server-file" : "url";
}

export function getServerFilename(release: ToolRelease) {
  return typeof release.artifact === "string" ? (release.artifact.split("/").at(-1) ?? "") : "";
}

export function makeDefaultRelease(releases: readonly ToolRelease[], index: number) {
  if (index <= 0 || index >= releases.length) return [...releases];
  return [releases[index], ...releases.slice(0, index), ...releases.slice(index + 1)];
}

export function withReleaseSource(
  release: ToolRelease,
  source: ReleaseSource,
  toolId: string,
): ToolRelease {
  if (source === "url") {
    return {
      version: release.version,
      download: typeof release.download === "string" ? release.download : "https://",
    };
  }
  return {
    version: release.version,
    artifact: `${toolId}/${release.version}/${getServerFilename(release)}`,
  };
}

export function withReleaseVersion(release: ToolRelease, version: string, toolId: string): ToolRelease {
  return typeof release.artifact === "string"
    ? { version, artifact: `${toolId}/${version}/${getServerFilename(release)}` }
    : { ...release, version };
}

export function withServerFilename(release: ToolRelease, filename: string, toolId: string): ToolRelease {
  return { version: release.version, artifact: `${toolId}/${release.version}/${filename.trim()}` };
}
