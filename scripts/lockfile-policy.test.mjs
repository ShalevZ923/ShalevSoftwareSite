import { describe, expect, it } from "vitest";
import { sameManifestValue } from "./lockfile-policy.mjs";

describe("lockfile manifest comparison", () => {
  it("ignores object key ordering without ignoring actual changes", () => {
    expect(
      sameManifestValue({ ajv: "8.20.0", vite: "8.3.5" }, { vite: "8.3.5", ajv: "8.20.0" }),
    ).toBe(true);
    expect(sameManifestValue({ ajv: "8.20.0" }, { ajv: "8.21.0" })).toBe(false);
    expect(sameManifestValue({ ajv: "8.20.0" }, {})).toBe(false);
    expect(sameManifestValue(["a", "b"], ["b", "a"])).toBe(false);
  });
});
