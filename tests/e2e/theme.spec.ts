import { expect, test } from "@playwright/test";

test.describe("theme", () => {
  test("toggles and persists across reloads without flashing", async ({ page }) => {
    await page.goto("/");
    const initial = await page.evaluate(() => document.documentElement.dataset.theme);

    await page.getByRole("button", { name: "Toggle colour theme" }).click();
    const flipped = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(flipped).not.toBe(initial);

    await page.reload();
    // The inline init script applies the stored theme before hydration.
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(flipped);
    expect(await page.evaluate(() => localStorage.getItem("aw:theme"))).toBe(flipped);
  });

  test("work inherits the selected theme", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle colour theme" }).click();
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);

    await page.getByRole("link", { name: /^Work/ }).click();
    await expect(page).toHaveURL(/\/work$/);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
  });
});
