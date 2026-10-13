import { describe, it, expect } from "vitest";
import { draftReducer } from "./useDraft";
describe("draft transitions", () => {
  it("tracks a typed edit and retains the draft while updating its saved baseline", () => {
    const initial = { draft: { name: "old" }, saved: JSON.stringify({ name: "old" }) };
    const edited = draftReducer(initial, { type: "edit", update: { name: "typed" } });
    expect(edited.saved).toBe(initial.saved);
    expect(edited.draft.name).toBe("typed");
    expect(draftReducer(edited, { type: "load", value: { name: "server" } })).toEqual({
      draft: { name: "server" },
      saved: JSON.stringify({ name: "server" }),
    });
  });
});
