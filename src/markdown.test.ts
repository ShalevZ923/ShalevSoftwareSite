import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  getTrustedHttpsUrl,
  getHeadingText,
  getTrustedImageSource,
  getTrustedLinkTarget,
} from "./markdown";

describe("Markdown safety boundaries", () => {
  it("keeps heading anchors stable when guides use inline Markdown formatting", () => {
    expect(getHeadingText(["Install ", createElement("strong", null, "now")])).toBe(
      "Install now",
    );
  });

  it("allows only local catalog images", () => {
    expect(getTrustedImageSource("/tool-images/pycharm.svg")).toBe(
      "/tool-images/pycharm.svg",
    );
    expect(getTrustedImageSource("https://tracker.invalid/pixel.png")).toBeUndefined();
    expect(getTrustedImageSource("/tool-images/../private.png")).toBeUndefined();
  });

  it("allows only safe guide links and HTTPS downloads", () => {
    expect(getTrustedLinkTarget("#install")).toBe("#install");
    expect(getTrustedLinkTarget("mailto:devex@atlas.local")).toBe(
      "mailto:devex@atlas.local",
    );
    expect(getTrustedLinkTarget("javascript:alert(1)")).toBeUndefined();
    expect(getTrustedLinkTarget("data:text/html,test")).toBeUndefined();
    expect(getTrustedHttpsUrl("https://example.com/download")).toBe(
      "https://example.com/download",
    );
    expect(getTrustedHttpsUrl("mailto:devex@atlas.local")).toBeUndefined();
  });
});
