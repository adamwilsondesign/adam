import { expect, test } from "@playwright/test";

const anyCell = "a[data-case-cell], button[data-client-cell]";

test.describe("work filtering", () => {
  test("all 40 clients fit in one viewport initially", async ({ page }) => {
    await page.goto("/work");
    await expect(page.locator(anyCell)).toHaveCount(40);
    const viewport = page.viewportSize()!;
    for (const cell of await page.locator(anyCell).all()) {
      const box = await cell.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.y).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    }
  });

  test("tag toggles recompose the grid and never empty it", async ({ page }) => {
    await page.goto("/work");
    await expect(page.locator(anyCell)).toHaveCount(40);

    const tags = ["AI", "AR", "Crypto", "R&D", "Hardware", "Enterprise", "Startup"];
    for (const tag of tags) {
      await page.getByRole("button", { name: tag, exact: true }).click();
      await page.waitForTimeout(250);
      expect(await page.locator(anyCell).count()).toBeGreaterThan(0);
    }
    // Only "Consumer" remains active; disabling it must be rejected.
    await page.getByRole("button", { name: "Consumer", exact: true }).click();
    await expect(page.getByRole("button", { name: "Consumer", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("status")).toContainText("kept");
    expect(await page.locator(anyCell).count()).toBeGreaterThan(0);
  });

  test("year slider is keyboard operable and clamps to valid ranges", async ({ page }) => {
    await page.goto("/work");
    const start = page.getByRole("slider", { name: "Start year" });
    await start.focus();

    await page.keyboard.press("ArrowRight");
    await expect(start).toHaveAttribute("aria-valuenow", "2011");

    // Home/End clamp inside bounds and never produce an empty grid.
    await page.keyboard.press("End");
    const clamped = Number(await start.getAttribute("aria-valuenow"));
    expect(clamped).toBeGreaterThanOrEqual(2010);
    expect(clamped).toBeLessThanOrEqual(2026);
    await page.waitForTimeout(700);
    expect(await page.locator(anyCell).count()).toBeGreaterThan(0);

    await page.keyboard.press("Home");
    await expect(start).toHaveAttribute("aria-valuenow", "2010");
  });

  test("logo order is stable for unrelated updates and reshuffles after a tag change", async ({
    page,
  }) => {
    await page.goto("/work");
    await expect(page.locator(anyCell)).toHaveCount(40);
    const readOrder = () =>
      page.locator(anyCell).evaluateAll((cells) => cells.map((c) => c.getAttribute("aria-label")));

    const initial = await readOrder();

    // Unrelated update: opening and closing a tooltip must not reshuffle.
    await page.locator("button[data-client-cell]").first().click();
    await expect(page.locator("#work-tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#work-tooltip")).toBeHidden();
    expect(await readOrder()).toEqual(initial);

    // A completed tag change reshuffles (40 items — an identical order is
    // astronomically unlikely).
    await page.getByRole("button", { name: "AI", exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "AI", exact: true }).click();
    await page.waitForTimeout(800);
    expect(await readOrder()).not.toEqual(initial);
  });

  test("tooltip opens on click (not hover), stays in the viewport, closes outside", async ({
    page,
  }) => {
    await page.goto("/work");
    const info = page.locator("button[data-client-cell]").first();
    const tooltip = page.locator("#work-tooltip");

    // Hover alone must not open it.
    await info.hover();
    await page.waitForTimeout(350);
    await expect(tooltip).toBeHidden();

    await info.click();
    await expect(tooltip).toBeVisible();
    await expect(info).toHaveAttribute("aria-expanded", "true");
    const box = await tooltip.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);

    // Clicking the same logo toggles it closed…
    await info.click();
    await expect(tooltip).toBeHidden();

    // …and clicking elsewhere dismisses an open one.
    await info.click();
    await expect(tooltip).toBeVisible();
    await page.mouse.click(10, viewport.height / 2);
    await expect(tooltip).toBeHidden();
  });
});
