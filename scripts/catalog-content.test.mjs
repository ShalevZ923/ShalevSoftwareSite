import { describe, expect, it } from "vitest";
import { loadCatalogEntries, machineCatalogIsCurrent, parseReleaseList, renderMachineCatalog, validateCatalogEntry } from "./catalog-content.mjs";

describe("release list parsing", () => {
  it("keeps each approved version paired with its HTTPS download URL", () => {
    expect(
      parseReleaseList(
        "26 | https://downloads.example.com/product-26.exe\n25 | https://downloads.example.com/product-25.exe",
        "test entry",
      ),
    ).toEqual([
      { version: "26", download: "https://downloads.example.com/product-26.exe" },
      { version: "25", download: "https://downloads.example.com/product-25.exe" },
    ]);
  });

  it("parses a same-server artifact pointer without turning it into an arbitrary URL", () => {
    expect(
      parseReleaseList(
        "26.1 | artifact:test-tool/26.1/test-tool-26.1-x64.msi",
        "test entry",
      ),
    ).toEqual([
      { version: "26.1", artifact: "test-tool/26.1/test-tool-26.1-x64.msi" },
    ]);
  });

  it("rejects duplicate versions and non-HTTPS download URLs", () => {
    expect(() =>
      parseReleaseList(
        "26 | https://downloads.example.com/product-26.exe\n26 | https://downloads.example.com/product-26-hotfix.exe",
        "test entry",
      ),
    ).toThrow("must not repeat a version");
    expect(() => parseReleaseList("25 | http://example.com/product.exe", "test entry")).toThrow(
      "credential-free HTTPS URL",
    );
    expect(() => parseReleaseList("25 | artifact:../private/product.exe", "test entry")).toThrow(
      "safe path characters",
    );
  });
});

describe("optional tool notices", () => {
  const metadata = {
    id: "test-tool",
    order: 1,
    name: "Test Tool",
    company: "Example",
    category: "Testing",
    platforms: ["Web"],
    lifecycle: "Current",
    icon: "TT",
    releases: [{ version: "1.0", download: "https://example.com/download" }],
    updated: "Today",
    description: "A test catalog entry.",
    support: { name: "Test Owner", team: "Test Team", initials: "TO", email: "owner@example.com" },
    tags: ["test"],
  };
  const guide = "## Install\n\nInstall it.\n\n## Support\n\nContact the owner.";

  it("accepts a notice only when its tone and message are valid", () => {
    expect(() => validateCatalogEntry("test-tool.md", {
      ...metadata,
      notice: { tone: "warning", title: "Retirement planned", message: "Move to the replacement before December." },
    }, guide)).not.toThrow();
    expect(() => validateCatalogEntry("test-tool.md", {
      ...metadata,
      notice: { tone: "urgent", title: "Invalid", message: "Invalid tone." },
    }, guide)).toThrow("notice.tone must be info or warning");
  });

  it("accepts a matching artifact pointer and rejects cross-tool or mismatched-version pointers", () => {
    expect(() => validateCatalogEntry("test-tool.md", {
      ...metadata,
      releases: [{ version: "1.0", artifact: "test-tool/1.0/test-tool.msi" }],
    }, guide)).not.toThrow();
    expect(() => validateCatalogEntry("test-tool.md", {
      ...metadata,
      releases: [{ version: "1.0", artifact: "other-tool/1.0/test-tool.msi" }],
    }, guide)).toThrow("tool-id must match");
    expect(() => validateCatalogEntry("test-tool.md", {
      ...metadata,
      releases: [{ version: "1.0", artifact: "test-tool/2.0/test-tool.msi" }],
    }, guide)).toThrow("version must match");
    expect(() => validateCatalogEntry("test-tool.md", {
      ...metadata,
      releases: [{ version: "1.0", download: "https://example.com", artifact: "test-tool/1.0/test-tool.msi" }],
    }, guide)).toThrow("exactly one download or artifact");
  });

  it("accepts reviewed guide resources and rejects unsafe or ambiguous delivery targets", () => {
    const resource = {
      id: "setup-guide",
      title: "Setup guide",
      kind: "internal-guide",
      format: "pdf",
      url: "https://sharepoint.atlas.local/sites/devex/setup.pdf",
      appliesTo: ["1.0"],
      owner: "Platform Engineering",
      reviewedOn: "2026-09-05",
    };
    expect(() => validateCatalogEntry("test-tool.md", { ...metadata, resources: [resource] }, guide)).not.toThrow();
    expect(() => validateCatalogEntry("test-tool.md", { ...metadata, resources: [{ ...resource, url: "file:///server/guide.pdf" }] }, guide)).toThrow("credential-free HTTPS URL");
    expect(() => validateCatalogEntry("test-tool.md", { ...metadata, resources: [{ ...resource, file: "test-tool/guide.pdf" }] }, guide)).toThrow("exactly one url or file");
    expect(() => validateCatalogEntry("test-tool.md", { ...metadata, resources: [{ ...resource, url: undefined, file: "other-tool/guide.pdf" }] }, guide)).not.toThrow();
  });
});

describe("hierarchical catalog source", () => {
  it("assembles a tool from its category, vendor, guide, and per-version release files", async () => {
    const entries = await loadCatalogEntries();
    const intellij = entries.find(({ metadata }) => metadata.id === "intellij");

    expect(intellij?.metadata).toMatchObject({
      company: "JetBrains",
      category: "IDEs & Code Editors",
      releases: expect.arrayContaining([{ version: "2025.1", download: "https://www.jetbrains.com/idea/download/" }]),
    });
    expect(intellij?.guide).toContain("## Install");
  });
});

describe("machine catalog feed", () => {
  it("renders a compact index and a tools feed without guides or support contacts", async () => {
    const entries = await loadCatalogEntries();
    const feed = renderMachineCatalog(entries, "2026-09-19T08:00:00.000Z");
    const index = JSON.parse(feed.index);
    const tools = JSON.parse(feed.tools);
    const intellijIndex = index.tools.find((tool) => tool.id === "intellij");
    const intellij = tools.tools.find((tool) => tool.id === "intellij");
    const jq = tools.tools.find((tool) => tool.id === "jq");

    expect(index).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-09-19T08:00:00.000Z",
    });
    expect(tools.schemaVersion).toBe(1);
    expect(index.tools.map((tool) => tool.id)).toEqual(entries.map(({ metadata }) => metadata.id));
    expect(intellijIndex).toEqual({
      id: "intellij",
      name: "IntelliJ IDEA",
      company: "JetBrains",
      category: "IDEs & Code Editors",
      platforms: ["Windows", "Linux", "macOS"],
      lifecycle: "Current",
      tags: ["Java", "Kotlin", "IDE", "JetBrains"],
      summary: "An intelligent IDE for JVM and web development, with code analysis, refactoring, Git tooling, and a mature plugin ecosystem.",
      defaultVersion: "2025.1",
    });
    expect(intellij).toMatchObject({
      id: "intellij",
      name: "IntelliJ IDEA",
      description: intellijIndex.summary,
      releases: expect.arrayContaining([{ version: "2025.1", download: "https://www.jetbrains.com/idea/download/" }]),
    });
    expect(jq.releases).toEqual([{ version: "1.8.2", artifact: "jq/1.8.2/jq-windows-amd64.exe" }]);
    expect(JSON.stringify(index)).not.toMatch(/@atlas\.local|## Install|devex@/);
    expect(JSON.stringify(tools)).not.toMatch(/@atlas\.local|## Install|Asset record/);
    expect(intellij).not.toHaveProperty("support");
    expect(intellij).not.toHaveProperty("facts");
    expect(intellij).not.toHaveProperty("guide");
  });

  it("treats matching feed files as current even when generatedAt differs", async () => {
    const entries = await loadCatalogEntries();
    const feed = renderMachineCatalog(entries, "2026-09-19T08:00:00.000Z");
    const later = renderMachineCatalog(entries, "2026-09-20T00:00:00.000Z");

    expect(machineCatalogIsCurrent(later.index, later.tools, entries)).toBe(true);
    expect(machineCatalogIsCurrent(feed.index, '{"schemaVersion":1}', entries)).toBe(false);
  });
});
