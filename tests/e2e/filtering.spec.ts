import { expect, test, type Page } from "@playwright/test";

import fixtures from "../../content/fixtures/clients.json";

const anyCell = "a[data-case-cell], button[data-client-cell]";

type FixtureEngagement = { startYear: number; endYear: number; tags: string[] };
type FixtureClient = { slug: string; engagements: FixtureEngagement[] };

const clients = (fixtures as { clients: FixtureClient[] }).clients;

/** Mirrors the engagement-aware OR logic for deterministic expectations. */
function matchingSlugs(tags: string[], years: { start: number; end: number }): string[] {
  return clients
    .filter((client) =>
      client.engagements.some(
        (engagement) =>
          engagement.startYear <= years.end &&
          engagement.endYear >= years.start &&
          (tags.length === 0 || engagement.tags.some((tag) => tags.includes(tag))),
      ),
    )
    .map((client) => client.slug);
}

const FULL = { start: 2010, end: 2026 };

/** Reads the current composition as fixture slugs, in display order. */
async function readOrder(page: Page): Promise<string[]> {
  return page
    .locator(anyCell)
    .evaluateAll((cells) =>
      cells.map(
        (cell) =>
          (cell as HTMLElement).dataset.caseCell ??
          ((cell as HTMLElement).dataset.clientCell ?? "").replace("placeholder.client.", ""),
      ),
    );
}

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

  test("All is the default; tags narrow, expand with OR, and All restores", async ({ page }) => {
    await page.goto("/work");
    const all = page.getByRole("button", { name: "All", exact: true });
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(anyCell)).toHaveCount(40);

    // Selecting a tag exits All and narrows to that tag.
    const aiCount = matchingSlugs(["AI"], FULL).length;
    await page.getByRole("button", { name: "AI", exact: true }).click();
    await expect(all).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(anyCell)).toHaveCount(aiCount);

    // A second tag expands the result set (inclusive OR).
    const orCount = matchingSlugs(["AI", "AR"], FULL).length;
    await page.getByRole("button", { name: "AR", exact: true }).click();
    await expect(page.locator(anyCell)).toHaveCount(orCount);
    expect(orCount).toBeGreaterThanOrEqual(aiCount);

    // The live count reads NN / 40.
    await expect(page.locator("#work-filters")).toContainText(
      `${String(orCount).padStart(2, "0")} / 40`,
    );

    // All clears individual tags and restores the complete collection.
    await all.click();
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(anyCell)).toHaveCount(40);
  });

  test("a toggle that would empty the grid is prevented with feedback", async ({ page }) => {
    // Find a (year, tag) pair with zero matches — deterministic from fixtures.
    let year = 0;
    let tag = "";
    outer: for (let y = FULL.start; y <= FULL.end; y++) {
      if (matchingSlugs([], { start: y, end: y }).length === 0) continue;
      for (const t of [
        "AI",
        "AR",
        "Crypto",
        "R&D",
        "Hardware",
        "Enterprise",
        "Startup",
        "Consumer",
      ]) {
        if (matchingSlugs([t], { start: y, end: y }).length === 0) {
          year = y;
          tag = t;
          break outer;
        }
      }
    }
    test.skip(year === 0, "fixture set covers every tag in every year");

    await page.goto("/work");
    const start = page.getByRole("slider", { name: "Start year" });
    const end = page.getByRole("slider", { name: "End year" });

    await end.focus();
    for (let y = FULL.end; y > year; y--) await page.keyboard.press("ArrowLeft");
    await expect(end).toHaveAttribute("aria-valuenow", String(year));
    await start.focus();
    for (let y = FULL.start; y < year; y++) await page.keyboard.press("ArrowRight");
    await expect(start).toHaveAttribute("aria-valuenow", String(year));
    await page.waitForTimeout(800);

    const pill = page.getByRole("button", { name: tag, exact: true });
    await expect(pill).toHaveAttribute("aria-disabled", "true");
    // aria-disabled makes Playwright's actionability treat the pill as
    // disabled; force the press — real pointers can still click it and must
    // receive the rejection feedback rather than silence.
    await pill.click({ force: true });
    await expect(pill).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("status")).toContainText("kept");
    expect(await page.locator(anyCell).count()).toBeGreaterThan(0);
  });

  test("survivors keep their positions; newcomers append; identical sets never reshuffle", async ({
    page,
  }) => {
    await page.goto("/work");
    await expect(page.locator(anyCell)).toHaveCount(40);
    const initial = await readOrder(page);

    // Narrowing: the surviving set keeps its exact relative order.
    const aiSet = new Set(matchingSlugs(["AI"], FULL));
    await page.getByRole("button", { name: "AI", exact: true }).click();
    await expect(page.locator(anyCell)).toHaveCount(aiSet.size);
    await page.waitForTimeout(500);
    const narrowed = await readOrder(page);
    expect(narrowed).toEqual(initial.filter((slug) => aiSet.has(slug)));

    // Expanding back to All: survivors stay at the head, newcomers follow.
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.locator(anyCell)).toHaveCount(40);
    await page.waitForTimeout(500);
    const restored = await readOrder(page);
    expect(restored.slice(0, narrowed.length)).toEqual(narrowed);

    // An identical result set produces no reshuffle at all.
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.waitForTimeout(300);
    expect(await readOrder(page)).toEqual(restored);

    // The explicit Shuffle control is the one way to re-randomize.
    await page.getByRole("button", { name: "Shuffle the composition" }).click();
    await page.waitForTimeout(600);
    expect(await readOrder(page)).not.toEqual(restored);
  });

  test("rapid filter input settles on one consistent result", async ({ page }) => {
    await page.goto("/work");
    await expect(page.locator(anyCell)).toHaveCount(40);

    // Three quick toggles with no settling time between them.
    await page.getByRole("button", { name: "AI", exact: true }).click();
    await page.getByRole("button", { name: "AR", exact: true }).click();
    await page.getByRole("button", { name: "Crypto", exact: true }).click();

    const expected = matchingSlugs(["AI", "AR", "Crypto"], FULL).length;
    // Within the reflow budget the displayed cells match the final selection —
    // no stale exit animations linger past ~450ms.
    await page.waitForTimeout(800);
    await expect(page.locator(anyCell)).toHaveCount(expected);
    await expect(page.locator("#work-filters")).toContainText(
      `${String(expected).padStart(2, "0")} / 40`,
    );
  });

  test("year slider is keyboard operable and clamps to valid ranges", async ({ page }) => {
    await page.goto("/work");
    const start = page.getByRole("slider", { name: "Start year" });
    await start.focus();

    await page.keyboard.press("ArrowRight");
    await expect(start).toHaveAttribute("aria-valuenow", "2011");

    await page.keyboard.press("PageUp");
    await expect(start).toHaveAttribute("aria-valuenow", "2016");
    await page.keyboard.press("PageDown");
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

  test("grid supports roving-tabindex arrow navigation", async ({ page }) => {
    await page.goto("/work");
    await expect(page.locator(anyCell)).toHaveCount(40);

    const first = page.locator('[data-grid-index="0"]');
    await first.focus();
    await expect(first).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-grid-index="1"]')).toBeFocused();

    await page.keyboard.press("End");
    await expect(page.locator('[data-grid-index="39"]')).toBeFocused();

    await page.keyboard.press("Home");
    await expect(first).toBeFocused();

    // Exactly one cell is tabbable, so Tab leaves the grid in one step.
    expect(
      await page
        .locator('a[data-case-cell][tabindex="0"], button[data-client-cell][tabindex="0"]')
        .count(),
    ).toBe(1);
  });

  test("skip link jumps keyboard users straight to the filters", async ({ page }) => {
    await page.goto("/work");
    const skip = page.getByRole("link", { name: "Skip to filters" });
    // The skip link sits within the first few tab stops (after the shell
    // chrome), well before the 40 grid cells it bypasses.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      if (await skip.evaluate((node) => node === document.activeElement)) break;
    }
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#work-filters")).toBeFocused();
  });
});

test.describe("informational tooltip", () => {
  test("opens on hover with intent delay, survives the corridor, closes on exit", async ({
    page,
  }) => {
    await page.goto("/work");
    const info = page.locator("button[data-client-cell]").first();
    const tooltip = page.locator("#work-tooltip");

    await info.hover();
    await expect(tooltip).toBeVisible();

    // Crossing from the logo onto the tooltip must not dismiss it.
    const tipBox = (await tooltip.boundingBox())!;
    await page.mouse.move(tipBox.x + tipBox.width / 2, tipBox.y + tipBox.height / 2);
    await page.waitForTimeout(300);
    await expect(tooltip).toBeVisible();

    // Leaving both closes it after the grace period.
    await page.mouse.move(4, page.viewportSize()!.height - 4);
    await expect(tooltip).toBeHidden();
  });

  test("opens on keyboard focus and closes on Escape", async ({ page }) => {
    await page.goto("/work");
    const info = page.locator("button[data-client-cell]").first();
    const tooltip = page.locator("#work-tooltip");

    await info.focus();
    await expect(tooltip).toBeVisible();
    await expect(info).toHaveAttribute("aria-describedby", "work-tooltip");

    await page.keyboard.press("Escape");
    await expect(tooltip).toBeHidden();
  });

  test("click pins it sticky; outside click dismisses; stays in the viewport", async ({ page }) => {
    await page.goto("/work");
    const info = page.locator("button[data-client-cell]").first();
    const tooltip = page.locator("#work-tooltip");
    const viewport = page.viewportSize()!;

    await info.click();
    await expect(tooltip).toBeVisible();
    await expect(info).toHaveAttribute("aria-expanded", "true");

    const box = await tooltip.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);

    // Sticky: moving the pointer far away does not close it…
    await page.mouse.move(4, viewport.height - 4);
    await page.waitForTimeout(300);
    await expect(tooltip).toBeVisible();

    // …but a press outside does.
    await page.mouse.click(4, viewport.height / 2);
    await expect(tooltip).toBeHidden();
  });
});
