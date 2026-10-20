import { describe, it, expect } from "vitest";
import { decodeTool, decodeCatalog, decodeDocList } from "./contracts";
import { tools } from "./data";
describe("runtime data boundaries", () => {
  it("accepts generated tools", () => {
    for (const tool of tools) expect(decodeTool(tool).id).toBe(tool.id);
  });
  it("rejects malformed nested success records", () => {
    for (const change of [
      { releases: [null] },
      { platforms: [123] },
      { support: { email: "x" } },
      { company: undefined },
      { resources: [{}] },
    ])
      expect(() => decodeTool({ ...tools[0], ...change })).toThrow();
    expect(() => decodeCatalog({ tools: [null], docs: {} })).toThrow();
    expect(() => decodeDocList([{}])).toThrow();
  });
});
