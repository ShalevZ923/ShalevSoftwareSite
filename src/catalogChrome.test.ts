import { describe, expect, it } from "vitest";
import {
  COPY_FEEDBACK_MS,
  armCopyFeedbackTimer,
  copyLinkAnnouncement,
  copyLinkLabel,
  searchShortcutHint,
} from "./catalogChrome";

describe("searchShortcutHint", () => {
  it("shows Ctrl+K on Linux and Windows", () => {
    expect(searchShortcutHint("Mozilla/5.0 (X11; Linux x86_64)", "Linux x86_64")).toBe("Ctrl+K");
    expect(searchShortcutHint("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32")).toBe("Ctrl+K");
  });

  it("shows ⌘K on Apple platforms", () => {
    expect(searchShortcutHint("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel")).toBe("⌘K");
  });
});

describe("copyLinkLabel", () => {
  it("returns idle, success, and visible failure copy", () => {
    expect(copyLinkLabel("idle")).toBe("Copy view link");
    expect(copyLinkLabel("copied")).toBe("Link copied");
    expect(copyLinkLabel("unavailable")).toBe("Could not copy the link");
  });
});

describe("copyLinkAnnouncement", () => {
  it("keeps recovery instructions in the live region only", () => {
    expect(copyLinkAnnouncement("idle")).toBe("");
    expect(copyLinkAnnouncement("copied")).toBe("Link copied");
    expect(copyLinkAnnouncement("unavailable")).toBe(
      "Could not copy the link. Copy the address from your browser instead.",
    );
  });
});

describe("armCopyFeedbackTimer", () => {
  it("clears the previous timer so a second copy restarts the full window", () => {
    const cleared: number[] = [];
    const started: number[] = [];
    let nextId = 1;
    const clearTimer = (id: number) => {
      cleared.push(id);
    };
    const startTimer = (_callback: () => void, ms: number) => {
      started.push(ms);
      return nextId++;
    };
    const first = armCopyFeedbackTimer(undefined, clearTimer, startTimer, () => {});
    const second = armCopyFeedbackTimer(first, clearTimer, startTimer, () => {});
    expect(cleared).toEqual([first]);
    expect(started).toEqual([COPY_FEEDBACK_MS, COPY_FEEDBACK_MS]);
    expect(second).not.toBe(first);
  });
});
