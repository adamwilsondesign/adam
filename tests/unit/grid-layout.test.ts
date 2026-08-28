import { describe, expect, it } from "vitest";

import { computeCellRects, computeGridLayout } from "@/features/work/grid-layout";

const GAP = 16;
const AREA = { width: 1328, height: 692 }; // 1440×900 minus chrome + margins

describe("computeGridLayout", () => {
  it.each([1, 2, 8, 20, 40, 50])("fits all %i logos inside one viewport", (count) => {
    const layout = computeGridLayout({ count, ...AREA, gap: GAP });
    const rects = computeCellRects(count, layout, GAP);
    expect(rects).toHaveLength(count);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(-0.5);
      expect(rect.y).toBeGreaterThanOrEqual(-0.5);
      expect(rect.x + rect.width).toBeLessThanOrEqual(AREA.width + 0.5);
      expect(rect.y + rect.height).toBeLessThanOrEqual(AREA.height + 0.5);
    }
  });

  it("uses equal cells", () => {
    const layout = computeGridLayout({ count: 40, ...AREA, gap: GAP });
    const rects = computeCellRects(40, layout, GAP);
    for (const rect of rects) {
      expect(rect.width).toBeCloseTo(layout.cellWidth, 5);
      expect(rect.height).toBeCloseTo(layout.cellHeight, 5);
    }
  });

  it("enlarges cells as the count shrinks", () => {
    const large = computeGridLayout({ count: 40, ...AREA, gap: GAP });
    const small = computeGridLayout({ count: 8, ...AREA, gap: GAP });
    expect(small.cellWidth * small.cellHeight).toBeGreaterThan(large.cellWidth * large.cellHeight);
  });

  it("caps a single logo's cell to preserve negative space", () => {
    const layout = computeGridLayout({ count: 1, ...AREA, gap: GAP });
    const usable = AREA.width * AREA.height;
    expect(layout.cellWidth * layout.cellHeight).toBeLessThanOrEqual(usable / 3 + 1);
    // Centred in the field.
    expect(layout.offsetX).toBeGreaterThan(0);
    expect(layout.offsetY).toBeGreaterThan(0);
  });

  it("centres a partial final row", () => {
    const count = 7;
    const layout = computeGridLayout({ count, ...AREA, gap: GAP });
    const rects = computeCellRects(count, layout, GAP);
    if (count % layout.columns !== 0) {
      const lastRect = rects[rects.length - 1]!;
      const firstRowRect = rects[0]!;
      const lastRowStart = rects[layout.columns * Math.floor(count / layout.columns)]!;
      expect(lastRowStart.x).toBeGreaterThan(firstRowRect.x);
      expect(lastRect.x + lastRect.width).toBeLessThan(AREA.width);
    }
  });

  it("handles degenerate inputs without crashing", () => {
    expect(computeGridLayout({ count: 0, ...AREA, gap: GAP }).columns).toBe(0);
    expect(computeGridLayout({ count: 5, width: 0, height: 0, gap: GAP }).columns).toBe(0);
    expect(computeCellRects(0, computeGridLayout({ count: 0, ...AREA, gap: GAP }), GAP)).toEqual(
      [],
    );
  });
});
