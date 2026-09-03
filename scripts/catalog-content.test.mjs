import { describe, expect, it } from "vitest";
import { parseReleaseList, validateCatalogEntry } from "./catalog-content.mjs";

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
});
