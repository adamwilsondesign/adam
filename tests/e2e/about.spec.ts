import { expect, test } from "@playwright/test";

test.describe("about page", () => {
  test("direct URL renders every section with metadata", async ({ page }) => {
    await page.goto("/about");
    await expect(page).toHaveTitle(/About — Adam Wilson/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/about$/);

    // Opening viewport: first-person intro and the facts row — no page title.
    await expect(page.getByText(/I'm a designer who likes building the thing/)).toBeVisible();
    await expect(page.getByText("Toronto, Canada")).toBeVisible();
    await expect(page.getByText("15+ years")).toBeVisible();

    // Sections exist below the fold.
    await expect(page.getByRole("heading", { name: "Experience" })).toBeAttached();
    await expect(page.getByRole("heading", { name: "What I care about" })).toBeAttached();
    await expect(page.getByRole("heading", { name: "Favourite movies" })).toBeAttached();
    await expect(page.getByRole("heading", { name: "Favourite books" })).toBeAttached();
    await expect(page.getByRole("link", { name: "Get in touch" })).toBeAttached();
  });

  test("the experience timeline opens at the newest end and pans", async ({ page }) => {
    await page.goto("/about");
    const timeline = page.getByRole("list", { name: "Experience" });
    await expect(timeline.getByRole("listitem")).toHaveCount(6);

    // Initially positioned at the newest (right) end.
    const initial = await timeline.evaluate((node) => node.scrollLeft);
    const max = await timeline.evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(max).toBeGreaterThan(50);
    expect(initial).toBeGreaterThan(max - 4);

    // Keyboard pans back toward the oldest entries.
    await timeline.focus();
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(async () => timeline.evaluate((node) => node.scrollLeft))
      .toBeLessThan(initial);
  });

  test("movie and book shelves render local cover artwork", async ({ page }) => {
    await page.goto("/about");
    const marquees = page.locator("[data-marquee]");
    await expect(marquees).toHaveCount(2);
    // Each shelf holds the visible set plus its aria-hidden loop copy.
    await expect(marquees.nth(0).locator("img")).toHaveCount(20);
    await expect(marquees.nth(1).locator("img")).toHaveCount(20);
    const firstCover = marquees.nth(0).locator("img").first();
    await expect(firstCover).toHaveAttribute("src", /\/placeholders\/covers\/movies\//);
    await expect(firstCover).toHaveAttribute("alt", /.+/);
  });

  test("home → about → home traversal through the shell chrome", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^About/ }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByText("Toronto, Canada")).toBeVisible();

    // The chrome shows the back control on About, like Work.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
    await expect(page.getByRole("link", { name: /^Work/ })).toBeVisible();

    // Reopening About starts at the top of the page again.
    await page.getByRole("link", { name: /^About/ }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByText(/I'm a designer who likes building the thing/)).toBeVisible();
  });

  test("browser back and forward preserve the route history", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^About/ }).click();
    await expect(page).toHaveURL(/\/about$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByText("Toronto, Canada")).toBeVisible();
  });
});

test.describe("about reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("content is available promptly without the descent", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^About/ }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByText("Toronto, Canada")).toBeVisible({ timeout: 1500 });
  });
});
