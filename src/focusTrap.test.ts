import { describe, expect, it } from "vitest";
import { wrapTabTarget } from "./focusTrap";

describe("wrapTabTarget", () => {
  it("wraps Tab from the last item to the first", () => {
    const first = { id: "first" };
    const last = { id: "last" };
    expect(wrapTabTarget("Tab", false, last, [first, last])).toBe(first);
  });

  it("wraps Shift+Tab from the first item to the last", () => {
    const first = { id: "first" };
    const last = { id: "last" };
    expect(wrapTabTarget("Tab", true, first, [first, last])).toBe(last);
  });

  it("ignores keys other than Tab", () => {
    const first = { id: "first" };
    expect(wrapTabTarget("Escape", false, first, [first])).toBeNull();
  });
});
