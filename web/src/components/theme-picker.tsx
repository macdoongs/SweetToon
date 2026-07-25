"use client";

import { useEffect, useState } from "react";
import {
  applyThemePreference,
  getStoredThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

const themeLabel: Record<ThemePreference, string> = {
  system: "시스템",
  light: "라이트",
  dark: "다크",
};

export function ThemePicker() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const refresh = (nextPreference = getStoredThemePreference()) => {
      setPreference(nextPreference);
      setResolved(applyThemePreference(nextPreference));
    };
    const handleSystemChange = () => {
      if (getStoredThemePreference() === "system") refresh("system");
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) refresh();
    };

    refresh();
    media.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      media.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const changeTheme = (nextPreference: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch {
      // The current tab can still use the theme when storage is unavailable.
    }
    setPreference(nextPreference);
    setResolved(applyThemePreference(nextPreference));
  };

  return (
    <label className="theme-picker">
      <span aria-hidden="true">{resolved === "dark" ? "☾" : "☀"}</span>
      <span className="sr-only">화면 테마</span>
      <select
        aria-label="화면 테마"
        onChange={(event) =>
          changeTheme(event.target.value as ThemePreference)
        }
        value={preference}
      >
        {(Object.keys(themeLabel) as ThemePreference[]).map((value) => (
          <option key={value} value={value}>
            {themeLabel[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
