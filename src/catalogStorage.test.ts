import { describe, expect, it } from "vitest";
import { filterSavedToolIds } from "./catalogStorage";

describe("saved catalog tools", () => {
  it("removes retired tools and deduplicates selections after a catalog refresh", () => {
    expect(filterSavedToolIds(["docker", "retired-tool", "docker", "jq"], new Set(["docker", "jq"]))).toEqual([
      "docker",
      "jq",
    ]);
  });
});
