export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "tool-atlas-theme";

type ThemeRoot = {
  dataset: { theme?: string };
  style: { colorScheme: string };
};

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function resolveTheme(stored: Theme | null, system: Theme): Theme {
  return stored ?? system;
}

export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeTheme(theme: Theme) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function systemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme, root?: ThemeRoot | HTMLElement) {
  const target = root ?? (typeof document === "undefined" ? undefined : document.documentElement);
  if (!target) return;
  target.dataset.theme = theme;
  target.style.colorScheme = theme;
}
