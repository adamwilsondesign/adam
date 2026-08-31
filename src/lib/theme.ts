export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "aw:theme";

/**
 * Runs before paint (inlined as the first element of <body>) so the stored
 * theme is applied without a hydration flash. The void is the default: this
 * design is dark by conviction, so first-time visitors land on black
 * regardless of system preference; the toggle (persisted) still rules.
 */
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    document.documentElement.dataset.theme = stored === "light" ? "light" : "dark";
  } catch (error) {
    document.documentElement.dataset.theme = "dark";
  }
})();`;
