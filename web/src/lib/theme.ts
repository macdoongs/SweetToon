export const THEME_STORAGE_KEY = "sweettoon:theme";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  return preference === "system"
    ? prefersDark
      ? "dark"
      : "light"
    : preference;
}

export function getStoredThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyThemePreference(
  preference: ThemePreference,
): ResolvedTheme {
  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const resolved = resolveTheme(preference, prefersDark);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) =>
      meta.setAttribute(
        "content",
        resolved === "dark" ? "#1b1817" : "#f5f0e7",
      ),
    );
  return resolved;
}

export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}",p=localStorage.getItem(k);if(p!=="light"&&p!=="dark"&&p!=="system")p="system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches),t=d?"dark":"light",r=document.documentElement;r.dataset.theme=t;r.dataset.themePreference=p;r.style.colorScheme=t;document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=d?"#1b1817":"#f5f0e7"})}catch(e){}})()`;
