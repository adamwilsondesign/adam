import { expect, test } from "@playwright/test";

test.describe("surreal anchor", () => {
  test("one orb persists across home, work and about — the same node, never remounted", async ({
    page,
  }) => {
    await page.goto("/");
    const orb = page.locator("[data-surreal-orb]");
    await expect(orb).toHaveCount(1);
    const probe = await orb.evaluate((el) => {
      (el as HTMLElement).dataset.probe = "persistent";
      return (el as HTMLElement).dataset.probe;
    });
    expect(probe).toBe("persistent");

    await page.getByRole("link", { name: /^Work/ }).click();
    await expect(page).toHaveURL(/\/work$/);
    await expect(orb).toHaveCount(1);
    expect(await orb.evaluate((el) => (el as HTMLElement).dataset.probe)).toBe("persistent");

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: /^About/ }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(orb).toHaveCount(1);
    expect(await orb.evaluate((el) => (el as HTMLElement).dataset.probe)).toBe("persistent");

    const box = await orb.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(10);
  });

  test("the atmosphere grade overlays the environment beneath the UI", async ({ page }) => {
    await page.goto("/");
    const grade = page.locator("[data-atmosphere-grade]");
    await expect(grade).toHaveCount(1);
    // It must never intercept interaction.
    expect(await grade.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    expect(await grade.evaluate((el) => getComputedStyle(el).zIndex)).toBe("0");
  });
});

test.describe("empty-state portal", () => {
  test("the monolith replaces the door: aperture, orb, glow — same semantics", async ({ page }) => {
    await page.goto("/work");
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByRole("heading", { name: "nothing to see here" })).toBeVisible();

    const door = page.getByRole("button", { name: "A door. Enter it." });
    await expect(door).toBeVisible();
    // The recurring orb aligned through the aperture, and the hover glow.
    await expect(door.locator("[data-aperture-glow]")).toHaveCount(1);
    expect(await door.locator("circle").count()).toBeGreaterThanOrEqual(2);

    // Hover deepens the aperture light; the object itself must not move.
    await page.waitForTimeout(800); // let the empty state's entrance settle
    const before = await door.boundingBox();
    await door.hover();
    await page.waitForTimeout(250);
    const after = await door.boundingBox();
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    const glowOpacity = await door
      .locator("[data-aperture-glow]")
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(glowOpacity)).toBeGreaterThan(0.2);
  });
});
