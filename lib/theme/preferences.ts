export type ThemePreference = "dark" | "light";

const STORAGE_KEY = "buxme-theme";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return "dark";
}

export function applyTheme(theme: ThemePreference): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
}

export function setStoredTheme(theme: ThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function initTheme(): ThemePreference {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}
