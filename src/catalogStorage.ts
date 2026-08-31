const savedToolsKey = "tool-atlas.saved-tools.v1";
const maximumSavedTools = 100;

/** Browser-local convenience data only; invalid or unknown records are discarded. */
export function readSavedToolIds(knownToolIds: ReadonlySet<string>) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(savedToolsKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    const uniqueIds = new Set<string>();
    for (const id of parsed) {
      if (typeof id === "string" && knownToolIds.has(id)) uniqueIds.add(id);
      if (uniqueIds.size === maximumSavedTools) break;
    }
    return [...uniqueIds];
  } catch {
    return [];
  }
}

export function writeSavedToolIds(toolIds: readonly string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(savedToolsKey, JSON.stringify(toolIds.slice(0, maximumSavedTools)));
  } catch {
    // Storage is optional: privacy settings and quota limits must not break the catalog.
  }
}
