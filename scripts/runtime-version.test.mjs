import { describe, expect, it } from "vitest";
import { assertSupportedNode, supportsNode } from "./runtime-version.mjs";

describe("supported Node runtime", () => {
  it.each(["24.11.0", "24.11.1", "24.19.0", "v24.12.0"])("accepts %s", (version) => {
    expect(supportsNode(version)).toBe(true);
    expect(() => assertSupportedNode(version)).not.toThrow();
  });
  it.each(["22.20.0", "24.0.0", "24.10.99", "25.0.0", "24.11.0-rc.1", "24", "bad"])(
    "rejects %s",
    (version) => {
      expect(supportsNode(version)).toBe(false);
      expect(() => assertSupportedNode(version)).toThrow("requires Node >=24.11.0 <25");
    },
  );
});
