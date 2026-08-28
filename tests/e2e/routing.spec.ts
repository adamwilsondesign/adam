import { expect, test } from "@playwright/test";

test.describe("case-study routing", () => {
  test("direct URL renders server content, metadata and survives refresh", async ({ page }) => {
    await page.goto("/work/auralith");
    await expect(page.locator("#case-study-title")).toHaveText("Field Console");
    await expect(page).toHaveTitle(/Field Console — Auralith/);

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /\/work\/auralith$/);
    await expect(page.locator('meta[property="og:title"]').first()).toHaveAttribute(
      "content",
      /Field Console/,
    );

    // CreativeWork structured data is present.
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(jsonLd).toContain('"CreativeWork"');

    await page.reload();
    await expect(page.locator("#case-study-title")).toHaveText("Field Console");
  });

  test("unknown slug returns the designed 404", async ({ page }) => {
    const response = await page.goto("/work/does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("This page isn’t part of the portfolio.")).toBeVisible();
  });

  test("grid open updates URL, Back closes, Forward reopens, state survives", async ({ page }) => {
    await page.goto("/work");
    const grid = page.locator("a[data-case-cell]").first();
    await grid.waitFor();

    // Change the filter state before opening the overlay.
    await page.getByRole("button", { name: "Crypto", exact: true }).click();
    await expect(page.getByRole("button", { name: "Crypto", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.waitForTimeout(700);
    const orderBefore = await page
      .locator("[data-case-cell], button[data-client-cell]")
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));

    const caseCell = page.locator("a[data-case-cell]").first();
    const slug = await caseCell.getAttribute("data-case-cell");
    await caseCell.click();
    await expect(page).toHaveURL(new RegExp(`/work/${slug}$`));
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/work$/);
    await expect(page.getByRole("dialog")).toBeHidden();

    // The exact previous Work state is restored: filters and composition.
    await expect(page.getByRole("button", { name: "Crypto", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    const orderAfter = await page
      .locator("[data-case-cell], button[data-client-cell]")
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));
    expect(orderAfter).toEqual(orderBefore);

    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/work/${slug}$`));
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("escape closes the modal and restores focus to the origin cell", async ({ page }) => {
    await page.goto("/work");
    const caseCell = page.locator("a[data-case-cell]").first();
    await caseCell.waitFor();
    const slug = await caseCell.getAttribute("data-case-cell");
    await caseCell.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(900);

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/work$/);
    await expect(page.locator(`a[data-case-cell="${slug}"]`)).toBeFocused();
  });

  test("home → work → home traversal", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^Work/ }).click();
    await expect(page).toHaveURL(/\/work$/);
    await expect(page.locator("a[data-case-cell]").first()).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: /^Work/ })).toBeVisible();
  });
});
