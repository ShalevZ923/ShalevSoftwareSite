import { describe, expect, it } from "vitest";
import { nextGuideId, parseGuideVersions } from "./guideEditing";

describe("guide editing", () => {
  it("allocates distinct IDs around existing and removed guides", () => {
    const resources = [{ id: "guide-1" }, { id: "guide-3" }, { id: "new-guide" }];
    const id = nextGuideId(resources);
    expect(id).toBe("guide-2");
    expect(nextGuideId([...resources, { id }])).toBe("guide-4");
  });
  it("normalizes completed version input without duplicates or empty values", () => {
    expect(parseGuideVersions("2025.1, 2026.01-Mac, ,2025.1,")).toEqual(["2025.1", "2026.01-Mac"]);
    expect(parseGuideVersions("")).toEqual([]);
  });
});
