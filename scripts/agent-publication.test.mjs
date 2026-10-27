import { describe, expect, it } from "vitest";
import { isDownloadableZip } from "./agent-publication.mjs";

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
