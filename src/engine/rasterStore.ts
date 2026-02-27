/** Module-level store for the last imported raster grid (TIF/GeoTIFF). */

import type { TifRasterGrid } from "./tifReader";

let currentGrid: TifRasterGrid | null = null;
let currentMeta: { width: number; height: number; noDataValue?: number } | null = null;

export function setRasterGrid(
  grid: TifRasterGrid,
  meta: { width: number; height: number; noDataValue?: number },
): void {
  currentGrid = grid;
  currentMeta = meta;
}

export function getRasterGrid() {
  return currentGrid && currentMeta ? { grid: currentGrid, meta: currentMeta } : null;
}

export function clearRasterGrid(): void {
  currentGrid = null;
  currentMeta = null;
}
