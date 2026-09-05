import { describe, expect, it } from "vitest";
import { tools, type Tool } from "./data";
import { defaultFilters } from "./catalog";
import { getReleaseDownloadTarget } from "./downloads";
import {
  catalogTargetFromSearch,
  resolveToolRelease,
  toolPageHref,
} from "./toolLinks";

const tool: Tool = {
  ...tools.find((item) => item.id === "jmeter")!,
  releases: [
    { version: "5.6.3", download: "https://example.com/jmeter/5.6.3.zip" },
    { version: "5.5", artifact: "jmeter/5.5/jmeter.zip" },
  ],
};

describe("tool navigation links", () => {
  it("creates documentation and catalog URLs with optional encoded versions", () => {
    expect(toolPageHref("catalog", "jmeter")).toBe("?page=catalog&tool=jmeter");
    const params = new URLSearchParams(
      toolPageHref("documentation", "jmeter", "5.6.3+build.1"),
    );
    expect(params.get("page")).toBe("documentation");
    expect(params.get("tool")).toBe("jmeter");
    expect(params.get("version")).toBe("5.6.3+build.1");
  });

  it("selects the linked release and its actual download target", () => {
    const link = catalogTargetFromSearch(
      toolPageHref("catalog", tool.id, "5.5"),
      [tool],
    );
    expect(link.target).toEqual({ toolId: "jmeter", version: "5.5" });
    expect(link.unavailableVersion).toBe(false);
    expect(
      getReleaseDownloadTarget(resolveToolRelease(tool, link.target?.version))
        ?.href,
    ).toBe("/downloads/jmeter/5.5/jmeter.zip");
  });

  it("falls back to the first approved release, never a URL supplied as a version", () => {
    for (const version of [
      "retired",
      "https://untrusted.example/install.exe",
    ]) {
      const link = catalogTargetFromSearch(
        toolPageHref("catalog", tool.id, version),
        [tool],
      );
      expect(link.target?.version).toBe("5.6.3");
      expect(link.unavailableVersion).toBe(true);
      expect(
        getReleaseDownloadTarget(resolveToolRelease(tool, version))?.href,
      ).toBe("https://example.com/jmeter/5.6.3.zip");
    }
    expect(resolveToolRelease(tool).version).toBe("5.6.3");
    expect(
      catalogTargetFromSearch("?tool=jmeter&version=", [tool])
        .unavailableVersion,
    ).toBe(false);
  });

  it("does not open an unrelated tool when a link is stale", () => {
    expect(
      catalogTargetFromSearch("?tool=removed&version=5.5", [tool]),
    ).toMatchObject({
      target: null,
      missingTool: true,
      unavailableVersion: false,
    });
    expect(catalogTargetFromSearch("?version=5.5", [tool])).toMatchObject({
      target: null,
      missingTool: false,
    });
  });

  it("clears conflicting filters but preserves filters that include the destination", () => {
    expect(
      catalogTargetFromSearch("?tool=jmeter&query=docker&platform=Web", [tool])
        .filters,
    ).toEqual(defaultFilters);
    expect(
      catalogTargetFromSearch("?tool=jmeter&query=apache&platform=Linux", [
        tool,
      ]).filters,
    ).toMatchObject({ query: "apache", platform: "Linux" });
    expect(catalogTargetFromSearch("?query=docker", [tool]).filters.query).toBe(
      "docker",
    );
  });
});
