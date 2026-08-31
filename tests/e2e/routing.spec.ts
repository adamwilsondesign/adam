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
    await page.getByRole("button", { name: "Fintech/Crypto", exact: true }).click();
    await expect(page.getByRole("button", { name: "Fintech/Crypto", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
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
    await expect(page.getByRole("button", { name: "Fintech/Crypto", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
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

  test("focus is trapped inside the open modal", async ({ page }) => {
    await page.goto("/work");
    const caseCell = page.locator("a[data-case-cell]").first();
    await caseCell.waitFor();
    await caseCell.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(900);

    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const inside = await dialog.evaluate((node) => node.contains(document.activeElement));
      expect(inside).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/work$/);
  });

  test("home → work → home traversal with persistent header controls", async ({ page }) => {
    await page.goto("/");
    // The homepage index teases the unreleased sections without linking them.
    await expect(page.getByText("About", { exact: false })).toBeVisible();
    await expect(page.getByText("Side Quests", { exact: false })).toBeVisible();
    expect(await page.getByRole("link", { name: /About/ }).count()).toBe(0);

    await page.getByRole("link", { name: /^Work/ }).click();
    await expect(page).toHaveURL(/\/work$/);
    await expect(page.locator("a[data-case-cell]").first()).toBeVisible();

    // Theme, contact and LinkedIn stay available on sub pages.
    await expect(page.getByRole("button", { name: "Toggle colour theme" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Contact" })).toBeVisible();
    await expect(page.getByRole("link", { name: /LinkedIn/ })).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: /^Work/ })).toBeVisible();
  });

  test("the contact icon opens the form dialog; Escape closes it", async ({ page }) => {
    await page.goto("/work");
    await page.getByRole("button", { name: "Contact" }).click();

    const dialog = page.getByRole("dialog", { name: "Get in touch" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/name \*/)).toHaveAttribute("required", "");
    await expect(dialog.getByLabel(/email \*/)).toHaveAttribute("required", "");
    await expect(dialog.getByLabel(/message \*/)).toHaveAttribute("required", "");
    await expect(dialog.getByLabel("company")).not.toHaveAttribute("required", "");
    await expect(dialog.getByRole("button", { name: "send message" })).toBeEnabled();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // The X control closes it too.
    await page.getByRole("button", { name: "Contact" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test("work exploration state survives a home round trip in-session", async ({ page }) => {
    await page.goto("/work");
    await page.locator("a[data-case-cell]").first().waitFor();
    await page.getByRole("button", { name: "AI", exact: true }).click();
    await page.waitForTimeout(600);
    const orderBefore = await page
      .locator("[data-case-cell], button[data-client-cell]")
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: /^Work/ }).click();
    await expect(page).toHaveURL(/\/work$/);
    await page.waitForTimeout(900);

    await expect(page.getByRole("button", { name: "AI", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const orderAfter = await page
      .locator("[data-case-cell], button[data-client-cell]")
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));
    expect(orderAfter).toEqual(orderBefore);
  });
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("work and case studies stay fully functional with short fades", async ({ page }) => {
    await page.goto("/work");
    await expect(page.locator("a[data-case-cell], button[data-client-cell]")).toHaveCount(40);

    const caseCell = page.locator("a[data-case-cell]").first();
    const slug = await caseCell.getAttribute("data-case-cell");
    await caseCell.click();
    // No long morph: the dialog resolves promptly.
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1500 });
    await expect(page).toHaveURL(new RegExp(`/work/${slug}$`));

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/work$/, { timeout: 1500 });

    // Filtering applies with immediate layout updates.
    await page.getByRole("button", { name: "AI", exact: true }).click();
    await page.waitForTimeout(400);
    expect(
      await page.locator("a[data-case-cell], button[data-client-cell]").count(),
    ).toBeGreaterThan(0);
  });
});
