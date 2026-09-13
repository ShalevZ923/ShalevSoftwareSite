import { afterEach, describe, expect, it } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  resolveTheme,
  systemTheme,
  writeTheme,
} from "./theme";

const originalWindow = globalThis.window;

function stubWindow(options: { stored?: string | null; systemDark?: boolean }) {
  const store = new Map<string, string>();
  if (options.stored) store.set(THEME_STORAGE_KEY, options.stored);

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      },
      matchMedia: (query: string) => ({
        matches: Boolean(options.systemDark) && query.includes("prefers-color-scheme: dark"),
      }),
    },
  });

  return store;
}

afterEach(() => {
  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});

describe("theme resolution", () => {
  it("prefers a stored dark choice over a light system setting", () => {
    expect(resolveTheme("dark", "light")).toBe("dark");
  });

  it("prefers a stored light choice over a dark system setting", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
  });

  it("uses the system theme when nothing is stored", () => {
    expect(resolveTheme(null, "dark")).toBe("dark");
    expect(resolveTheme(null, "light")).toBe("light");
  });
});

describe("theme storage", () => {
  it("returns a stored light or dark value", () => {
    stubWindow({ stored: "dark" });
    expect(readStoredTheme()).toBe("dark");
  });

  it("ignores invalid stored values", () => {
    stubWindow({ stored: "dim" });
    expect(readStoredTheme()).toBeNull();
  });

  it("persists an explicit theme choice", () => {
    const store = stubWindow({});
    writeTheme("light");
    expect(store.get(THEME_STORAGE_KEY)).toBe("light");
    expect(readStoredTheme()).toBe("light");
  });
});

describe("system theme", () => {
  it("reads prefers-color-scheme from the browser", () => {
    stubWindow({ systemDark: true });
    expect(systemTheme()).toBe("dark");
    stubWindow({ systemDark: false });
    expect(systemTheme()).toBe("light");
  });
});

describe("applyTheme", () => {
  it("sets data-theme and color-scheme on the document root", () => {
    const root = { dataset: {} as Record<string, string>, style: { colorScheme: "" } };
    applyTheme("dark", root);
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });
});
