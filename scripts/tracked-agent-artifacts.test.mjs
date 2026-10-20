import { describe, expect, it } from "vitest";
import { trackedAgentEntries } from "./check-agent-artifacts.mjs";
describe("tracked-source archive audit scope", () => {
  const entry = { metadata: { id: "fixture", releases: [
    { version: "1", artifact: "fixture/1/tracked.zip" },
    { version: "2", artifact: "fixture/2/environment-specific.zip" },
  ] } };
  it("audits tracked releases without claiming to validate an external volume", () => {
    const selected = trackedAgentEntries([entry], [{ id: "fixture", version: "1" }]);
    expect(selected[0].metadata.releases).toEqual([entry.metadata.releases[0]]);
    expect(entry.metadata.releases).toHaveLength(2);
  });
  it("fails rather than silently skipping a missing or duplicated source declaration", () => {
    expect(() => trackedAgentEntries([entry], [{ id: "fixture", version: "missing" }])).toThrow("unique declared");
    expect(() => trackedAgentEntries([entry], [{ id: "fixture", version: "1" }, { id: "fixture", version: "1" }])).toThrow("unique declared");
  });
});
