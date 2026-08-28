"use client";

import { createContext, useCallback, useContext, useState } from "react";

import { track } from "@/lib/analytics";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => undefined,
});

/**
 * Client-side theme state. The actual initial theme is applied to
 * <html data-theme> by THEME_INIT_SCRIPT before paint; this provider adopts
 * that value after hydration and handles toggling + persistence.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // On the client the init script has already stamped <html data-theme>
  // before hydration, so the initial state can adopt it directly. No visible
  // markup depends on this value during hydration (icons are CSS-driven).
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "light"
      ? "light"
      : "dark",
  );

  const toggleTheme = useCallback(() => {
    setTheme((previous) => {
      const next: Theme = previous === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Private browsing without storage — the choice lasts for the session.
      }
      track({ name: "theme_changed", theme: next });
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
