import type { PaperSize, RectMm } from './types';

/** Layout grid for placing frame elements, in paper millimetres. */
export interface LayoutGrid {
  /** A point every grid line passes through (the map's top-left corner). */
  originX: number;
  originY: number;
  stepX: number;
  stepY: number;
}

/** Roughly how many cells fit across the sheet's short side. */
const CELLS_ON_SHORT_SIDE = 40;

/**
 * A grid that splits the map into an even number of cells each way, so the
 * map's edges and centre lines are always grid lines, and that carries on with
 * the same step into the margins. Cells come out close to square.
 */
export function layoutGrid(map: RectMm, paper: PaperSize): LayoutGrid {
  const target = Math.min(paper.widthMm, paper.heightMm) / CELLS_ON_SHORT_SIDE;
  const cells = (length: number) => Math.max(2, 2 * Math.round(length / target / 2));
  return { originX: map.x, originY: map.y, stepX: map.w / cells(map.w), stepY: map.h / cells(map.h) };
}

/** Nearest grid line to `value`. */
export const snapTo = (value: number, origin: number, step: number) => origin + Math.round((value - origin) / step) * step;
