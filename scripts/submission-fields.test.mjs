import { describe, it, expect } from "vitest";
import { section, selectedPlatforms, optionalFacts } from "./submission-fields.mjs";
describe("provider-independent submission fields", () => {
  it("accepts both issue form formats", () => {
    for (const body of [
      "### Name\nTool\n\n### Other\nValue",
      "### Name\n<!-- hint -->\nTool\n\n### Other\nValue",
    ]) {
      expect(section(body, "Name")).toBe("Tool");
    }
    expect(selectedPlatforms("- [x] Windows\n- [ ] Linux")).toEqual(["Windows"]);
    expect(optionalFacts("Owner: Team")).toEqual([{ label: "Owner", value: "Team" }]);
  });
});
