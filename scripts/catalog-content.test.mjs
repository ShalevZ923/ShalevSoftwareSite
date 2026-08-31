import { describe, expect, it } from "vitest";
import { parseReleaseList } from "./catalog-content.mjs";

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
