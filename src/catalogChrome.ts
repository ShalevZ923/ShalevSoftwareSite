export type CopyLinkState = "idle" | "copied" | "unavailable";

export const COPY_FEEDBACK_MS = 2500;

export function searchShortcutHint(userAgent: string, platform = "") {
  return /Mac|iPhone|iPad|iPod/i.test(`${platform} ${userAgent}`) ? "⌘K" : "Ctrl+K";
}

export function copyLinkLabel(state: CopyLinkState) {
  if (state === "copied") return "Link copied";
  if (state === "unavailable") return "Could not copy the link";
  return "Copy view link";
}

export function copyLinkAnnouncement(state: CopyLinkState) {
  if (state === "copied") return "Link copied";
  if (state === "unavailable") {
    return "Could not copy the link. Copy the address from your browser instead.";
  }
  return "";
}

export function armCopyFeedbackTimer(
  currentTimer: number | undefined,
  clearTimer: (id: number) => void,
  startTimer: (callback: () => void, ms: number) => number,
  onIdle: () => void,
  duration = COPY_FEEDBACK_MS,
) {
  if (currentTimer !== undefined) clearTimer(currentTimer);
  return startTimer(onIdle, duration);
}
