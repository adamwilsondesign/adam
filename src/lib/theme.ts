export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "aw:theme";

/**
 * Runs before paint (inlined as the first element of <body>) so the stored or
 * system theme is applied without a hydration flash. Light is the default.
 */
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
})();`;
