import { describe, expect, it } from "vitest";
import {
  getReleaseSource,
  getServerFilename,
  makeDefaultRelease,
  withReleaseSource,
  withReleaseVersion,
  withServerFilename,
} from "./releaseEditing";

describe("release editing", () => {
  const releases = [
    { version: "2.0", download: "https://example.com/2" },
    { version: "1.0", artifact: "test-tool/1.0/test-tool.msi" },
  ] as const;

  it("moves a selected approved release to the default position", () => {
    expect(makeDefaultRelease(releases, 1).map((release) => release.version)).toEqual(["1.0", "2.0"]);
  });

  it("keeps server-file paths aligned with the tool and release version", () => {
    expect(getReleaseSource(releases[1])).toBe("server-file");
    expect(getServerFilename(releases[1])).toBe("test-tool.msi");
    expect(withReleaseVersion(releases[1], "1.1", "test-tool")).toEqual({
      version: "1.1",
      artifact: "test-tool/1.1/test-tool.msi",
    });
    expect(withServerFilename(releases[1], "test-tool-x64.msi", "test-tool")).toEqual({
      version: "1.0",
      artifact: "test-tool/1.0/test-tool-x64.msi",
    });
  });

  it("switches URL and server-file targets without an artifact prefix field", () => {
    expect(withReleaseSource(releases[0], "server-file", "test-tool")).toEqual({
      version: "2.0",
      artifact: "test-tool/2.0/",
    });
    expect(withReleaseSource(releases[1], "url", "test-tool")).toEqual({
      version: "1.0",
      download: "https://",
    });
  });
});
