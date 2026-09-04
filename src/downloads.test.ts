import { describe, expect, it } from "vitest";
import { getReleaseDownloadTarget, getTrustedHttpsUrl } from "./downloads";

describe("release download targets", () => {
  it("keeps approved HTTPS releases external", () => {
    expect(getReleaseDownloadTarget({
      version: "1.0",
      download: "https://downloads.example.com/tool.exe",
    })).toEqual({
      href: "https://downloads.example.com/tool.exe",
      external: true,
    });
  });

  it("maps artifact pointers to the same-origin download route", () => {
    expect(getReleaseDownloadTarget({
      version: "1.0",
      artifact: "test-tool/1.0/test-tool-x64.msi",
    })).toEqual({
      href: "/downloads/test-tool/1.0/test-tool-x64.msi",
      external: false,
      filename: "test-tool-x64.msi",
    });
  });

  it("fails closed for unsafe local paths and credential-bearing URLs", () => {
    expect(getReleaseDownloadTarget({
      version: "1.0",
      artifact: "../private/secret.txt",
    })).toBeUndefined();
    expect(getTrustedHttpsUrl("https://user:secret@example.com/tool.exe")).toBeUndefined();
    expect(getTrustedHttpsUrl("javascript:alert(1)")).toBeUndefined();
  });
});
