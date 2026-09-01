import { expect, test } from "@playwright/test";

/**
 * Night is the permanent art direction: no theme switching exists anywhere,
 * no stored preference is read, and nothing light-coloured ever paints.
 */
test.describe("permanent night mode", () => {
  test("no theme toggle, no theme attribute, no stored preference", async ({ page }) => {
    await page.goto("/");
    expect(await page.getByRole("button", { name: /theme/i }).count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
    expect(await page.evaluate(() => localStorage.getItem("aw:theme"))).toBeNull();

    await page.getByRole("link", { name: /^Work/ }).click();
    await expect(page).toHaveURL(/\/work$/);
    expect(await page.getByRole("button", { name: /theme/i }).count()).toBe(0);
  });

  test("paints the night palette from the very first frame (no light flash)", async ({ page }) => {
    // Even before hydration completes, the document background must be void.
    await page.goto("/", { waitUntil: "commit" });
    await page.waitForSelector("body", { state: "attached" });
    const early = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(early).toBe("rgb(0, 0, 0)");

    await page.waitForLoadState("load");
    const settled = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(settled).toBe("rgb(0, 0, 0)");
  });

  test("a stale stored preference from the old toggle is ignored", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("aw:theme", "light"));
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      "rgb(0, 0, 0)",
    );
  });
});
