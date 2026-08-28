/**
 * Desktop Work grid geometry.
 *
 * Given the visible-client count and the usable area between the header and
 * the filter dock, chooses the row/column arrangement that maximizes useful
 * cell size while keeping every logo inside one viewport, then centers the
 * composition. Cell area is capped so small result counts keep generous
 * negative space instead of becoming billboards (~1/6 of the usable area for
 * the logo once cell padding is applied).
 */

export type GridInput = {
  count: number;
  width: number;
  height: number;
  gap: number;
  /** Upper bound on a single cell's share of the usable area. */
  maxCellFraction?: number;
};

export type GridLayout = {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  offsetX: number;
  offsetY: number;
};

export type CellRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_MAX_CELL_FRACTION = 1 / 3;
/** Preferred cell aspect ratio; slightly wide suits mixed logo proportions. */
const TARGET_CELL_ASPECT = 1.45;

export function computeGridLayout(input: GridInput): GridLayout {
  const { count, width, height, gap } = input;
  const maxCellFraction = input.maxCellFraction ?? DEFAULT_MAX_CELL_FRACTION;

  if (count <= 0 || width <= 0 || height <= 0) {
    return { columns: 0, rows: 0, cellWidth: 0, cellHeight: 0, offsetX: 0, offsetY: 0 };
  }

  let best: { columns: number; rows: number; cellWidth: number; cellHeight: number } | null = null;
  let bestScore = -Infinity;
  let bestAspectDelta = Infinity;

  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const cellWidth = (width - (columns - 1) * gap) / columns;
    const cellHeight = (height - (rows - 1) * gap) / rows;
    if (cellWidth <= 0 || cellHeight <= 0) continue;

    const score = Math.min(cellWidth, cellHeight);
    const aspectDelta = Math.abs(cellWidth / cellHeight - TARGET_CELL_ASPECT);
    if (
      score > bestScore + 0.5 ||
      (Math.abs(score - bestScore) <= 0.5 && aspectDelta < bestAspectDelta)
    ) {
      best = { columns, rows, cellWidth, cellHeight };
      bestScore = score;
      bestAspectDelta = aspectDelta;
    }
  }

  if (!best) {
    return {
      columns: 1,
      rows: count,
      cellWidth: width,
      cellHeight: height / count,
      offsetX: 0,
      offsetY: 0,
    };
  }

  // Keep sparse grids from ballooning: cap the cell area, preserving aspect.
  const maxArea = width * height * maxCellFraction;
  let { cellWidth, cellHeight } = best;
  const area = cellWidth * cellHeight;
  if (area > maxArea) {
    const scale = Math.sqrt(maxArea / area);
    cellWidth *= scale;
    cellHeight *= scale;
  }

  const gridWidth = best.columns * cellWidth + (best.columns - 1) * gap;
  const gridHeight = best.rows * cellHeight + (best.rows - 1) * gap;

  return {
    columns: best.columns,
    rows: best.rows,
    cellWidth,
    cellHeight,
    offsetX: (width - gridWidth) / 2,
    offsetY: (height - gridHeight) / 2,
  };
}

/**
 * Row-major cell rectangles for `count` items; a partial final row is
 * centered so the composition stays balanced.
 */
export function computeCellRects(count: number, layout: GridLayout, gap: number): CellRect[] {
  const rects: CellRect[] = [];
  if (layout.columns <= 0) return rects;
  const fullRows = Math.floor(count / layout.columns);
  const remainder = count % layout.columns;

  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / layout.columns);
    const column = index % layout.columns;
    const isLastPartialRow = remainder > 0 && row === fullRows;
    const rowOffset = isLastPartialRow
      ? ((layout.columns - remainder) * (layout.cellWidth + gap)) / 2
      : 0;
    rects.push({
      x: layout.offsetX + rowOffset + column * (layout.cellWidth + gap),
      y: layout.offsetY + row * (layout.cellHeight + gap),
      width: layout.cellWidth,
      height: layout.cellHeight,
    });
  }
  return rects;
}
