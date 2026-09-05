import { expect, test } from "@playwright/test";

test.describe("persistent atmosphere", () => {
  test("the live-cloud root survives home, work and about navigation", async ({ page }) => {
    await page.goto("/");
    // Hermetic builds disable WebGL, but retain the persistent environment
    // root and its fallback. GPU rendering is evaluated in the real preview.
    const clouds = page.locator("[data-live-clouds]");
    await expect(clouds).toHaveCount(1);
    await expect(clouds).toHaveAttribute("aria-hidden", "true");
    await clouds.evaluate((el) => {
      (el as HTMLElement).dataset.persistenceProbe = "original-root";
    });
    expect(await clouds.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");

    await page.getByRole("link", { name: /^Work/ }).click();
    await expect(page).toHaveURL(/\/work$/);
    await expect(page.locator("a[data-case-cell], button[data-client-cell]")).toHaveCount(40);
    await expect(clouds).toHaveCount(1);
    await expect(clouds).toHaveAttribute("data-persistence-probe", "original-root");

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: /^About/ }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByText("Toronto, Canada")).toBeVisible();
    await expect(clouds).toHaveCount(1);
    await expect(clouds).toHaveAttribute("data-persistence-probe", "original-root");
  });

  test("site navigation has no burger at mobile, tablet or desktop widths", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/", "/work", "/about"]) {
        await page.goto(path);
        const header = page.getByRole("banner");
        await expect(header).toBeVisible();
        await expect(
          header.getByRole("button", { name: /menu/i, includeHidden: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("dialog", { name: "Site menu", includeHidden: true }),
        ).toHaveCount(0);
        await expect(header.getByRole("button", { name: "Contact", exact: true })).toBeVisible();
        await expect(header.getByRole("link", { name: /LinkedIn/ })).toBeVisible();
      }
    }
  });
});

test.describe("accessible fallback doorway", () => {
  test("clearing projects reveals a stationary, keyboard-operable doorway", async ({ page }) => {
    await page.goto("/work");
    await expect(page.locator("a[data-case-cell], button[data-client-cell]")).toHaveCount(40);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.locator("a[data-case-cell], button[data-client-cell]")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "nothing to see here" })).toBeVisible();
    await expect(page.getByText("select all or a tag to bring the work back")).toBeVisible();

    const door = page.getByRole("button", { name: "A door. Enter it.", exact: true });
    await expect(door).toBeVisible();
    await expect(door).toBeEnabled();
    await expect(door.locator("svg")).toBeVisible();
    await expect(door.locator("svg")).toHaveAttribute("aria-hidden", "true");

    const before = await door.boundingBox();
    expect(before).not.toBeNull();
    await door.hover();
    await expect
      .poll(async () =>
        Number(
          await door.locator("[data-aperture-glow]").evaluate((el) => getComputedStyle(el).opacity),
        ),
      )
      .toBeGreaterThan(0.8);
    const after = await door.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    expect(Math.abs(after!.width - before!.width)).toBeLessThan(1);

    await door.focus();
    await expect(door).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/secret$/, { timeout: 8000 });
    await expect(page.getByText("you found the door.")).toBeVisible();
  });
});
