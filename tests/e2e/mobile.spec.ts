import { expect, test } from "@playwright/test";

/** Finds a cell whose box lies fully inside the usable viewport. */
async function visibleCell(page: import("@playwright/test").Page, selector: string) {
  const viewport = page.viewportSize()!;
  for (const cell of await page.locator(selector).all()) {
    const box = await cell.boundingBox();
    if (
      box &&
      box.x >= 4 &&
      box.y >= 90 &&
      box.x + box.width <= viewport.width - 4 &&
      box.y + box.height <= viewport.height - 170
    ) {
      return cell;
    }
  }
  return null;
}

test.describe("mobile work canvas", () => {
  test("renders the canvas with the bottom dock and safe hit targets", async ({ page }) => {
    await page.goto("/work");
    await expect(page.getByRole("slider", { name: "Start year" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI", exact: true })).toBeVisible();

    const cell = await visibleCell(page, "[data-client-cell], a[data-case-cell]");
    expect(cell).not.toBeNull();
    const box = await cell!.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("informational tap opens the card; dismissal restores the canvas", async ({ page }) => {
    await page.goto("/work");
    await page.waitForTimeout(800);
    const info = await visibleCell(page, "button[data-client-cell]");
    test.skip(!info, "no informational cell in the initial viewport for this shuffle");

    const label = await info!.getAttribute("aria-label");
    await info!.tap();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(label).toContain((await dialog.getAttribute("aria-label"))!.replace(" — details", ""));

    await dialog.getByRole("button", { name: "Close details" }).tap();
    await expect(dialog).toBeHidden();
    // The canvas beneath is untouched and interactive again.
    await expect(page.locator("button[data-client-cell]").first()).toBeVisible();
  });

  test("case tap routes to the slug; browser back restores /work", async ({ page }) => {
    await page.goto("/work");
    await page.waitForTimeout(800);
    const cell = await visibleCell(page, "a[data-case-cell]");
    test.skip(!cell, "no case-study cell in the initial viewport for this shuffle");

    const slug = await cell!.getAttribute("data-case-cell");
    await cell!.tap();
    await expect(page).toHaveURL(new RegExp(`/work/${slug}$`));
    // The sheet rises directly — no intermediate logo travel.
    await expect(page.getByRole("dialog", { name: /./ })).toBeVisible({ timeout: 6000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/work$/);
  });

  test("direct mobile case URL renders the sheet content", async ({ page }) => {
    await page.goto("/work/auralith");
    await expect(page.locator("#case-sheet-title")).toHaveText("Field Console");
  });

  test("the more-case-studies logo row navigates in place", async ({ page }) => {
    // Arrive via the grid so history has a /work entry beneath the study.
    await page.goto("/work");
    await page.goto("/work/auralith");
    await expect(page.locator("#case-sheet-title")).toHaveText("Field Console");

    // Both variants render the row; scope to the mobile sheet's visible one.
    const nav = page.locator('nav[aria-label="More case studies"]').filter({ visible: true });
    await nav.scrollIntoViewIfNeeded();
    await expect(nav.getByText("more case studies")).toBeVisible();
    const sibling = nav.getByRole("button").first();
    await expect(sibling).toBeVisible();
    await sibling.tap();

    // The slug swaps in place; a different case study renders.
    await expect(page).toHaveURL(/\/work\/(?!auralith$)[a-z-]+$/);
    await expect(page.locator("#case-sheet-title")).not.toHaveText("Field Console");

    // Back closes to the grid, never to the previous case study.
    await page.goBack();
    await expect(page).toHaveURL(/\/work$/);
  });
});

test.describe("mobile about page", () => {
  test("renders the opening viewport, stacked shelves and timeline peek", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByText(/I'm a designer who likes building the thing/)).toBeVisible();
    await expect(page.getByText("Toronto, Canada")).toBeVisible();

    // The shelves stack vertically on mobile.
    const marquees = page.locator("[data-marquee]");
    await expect(marquees).toHaveCount(2);
    const first = await marquees.nth(0).boundingBox();
    const second = await marquees.nth(1).boundingBox();
    expect(second!.y).toBeGreaterThan(first!.y + first!.height - 1);

    // The timeline shows roughly one entry with the neighbour peeking in.
    const timeline = page.getByRole("list", { name: "Experience" });
    const entry = timeline.getByRole("listitem").first();
    const entryBox = await entry.boundingBox();
    const viewport = page.viewportSize()!;
    expect(entryBox!.width).toBeGreaterThan(viewport.width * 0.45);
    expect(entryBox!.width).toBeLessThan(viewport.width * 0.95);
  });
});
