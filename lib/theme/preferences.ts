export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "buxme-theme";
const DARK_THEME: ResolvedTheme = "dark";

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }

  return DARK_THEME;
}

function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return DARK_THEME;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return DARK_THEME;
}

export function setStoredThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, preference);
  applyTheme(resolveTheme(preference));
}

export function initTheme(): ResolvedTheme {
  const theme = resolveTheme(getStoredThemePreference());
  applyTheme(theme);
  return theme;
}

export function subscribeToSystemTheme(
  onChange?: (theme: ResolvedTheme) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
  const handleChange = () => {
    if (getStoredThemePreference() !== "system") {
      return;
    }

    const theme = resolveTheme("system");
    applyTheme(theme);
    onChange?.(theme);
  };

  mediaQuery.addEventListener("change", handleChange);

  return () => mediaQuery.removeEventListener("change", handleChange);
}

export function getStoredTheme(): ThemePreference {
  return getStoredThemePreference();
}

export function setStoredTheme(preference: ThemePreference): void {
  setStoredThemePreference(preference);
}
