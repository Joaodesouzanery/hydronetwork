/**
 * Contour line extraction from raster elevation grids using Marching Squares.
 * Pure TypeScript — zero external dependencies.
 */

export interface ContourLine {
  elevation: number;
  segments: Array<[number, number][]>;
}

export interface ContourStats {
  min: number;
  max: number;
  mean: number;
  validCells: number;
}

export interface ContourExtractionResult {
  contours: ContourLine[];
  stats: ContourStats;
}

// Marching squares lookup: for each of the 16 cases, edges crossed.
// Edge encoding: 0=bottom, 1=right, 2=top, 3=left
// Each case produces 0, 1, or 2 line segments (saddle point ambiguity resolved by average).
const EDGE_TABLE: number[][] = [
  [],           // 0000
  [3, 0],       // 0001
  [0, 1],       // 0010
  [3, 1],       // 0011
  [1, 2],       // 0100
  [3, 0, 1, 2], // 0101 (saddle — two segments)
  [0, 2],       // 0110
  [3, 2],       // 0111
  [2, 3],       // 1000
  [2, 0],       // 1001
  [2, 3, 0, 1], // 1010 (saddle — two segments)
  [2, 1],       // 1011
  [1, 3],       // 1100
  [1, 0],       // 1101
  [0, 3],       // 1110
  [],           // 1111
];

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Get interpolated point on an edge of a cell.
 * edge: 0=bottom (bl→br), 1=right (br→tr), 2=top (tl→tr), 3=left (bl→tl)
 */
function edgePoint(
  col: number, row: number,
  bl: number, br: number, tr: number, tl: number,
  threshold: number, edge: number,
  originX: number, originY: number, dx: number, dy: number,
): [number, number] {
  let px: number, py: number;
  switch (edge) {
    case 0: { // bottom: bl → br
      const t = (threshold - bl) / (br - bl || 1e-10);
      px = col + t;
      py = row + 1;
      break;
    }
    case 1: { // right: br → tr
      const t = (threshold - br) / (tr - br || 1e-10);
      px = col + 1;
      py = row + 1 - t;
      break;
    }
    case 2: { // top: tl → tr
      const t = (threshold - tl) / (tr - tl || 1e-10);
      px = col + t;
      py = row;
      break;
    }
    case 3: { // left: bl → tl
      const t = (threshold - bl) / (tl - bl || 1e-10);
      px = col;
      py = row + 1 - t;
      break;
    }
    default:
      px = col;
      py = row;
  }
  return [originX + px * dx, originY + py * dy];
}

/**
 * Extract contour lines from a raster elevation grid.
 *
 * @param data - 1D array of elevation values (row-major, top-to-bottom)
 * @param width - Grid width in pixels
 * @param height - Grid height in pixels
 * @param origin - [x, y] of top-left pixel center
 * @param pixelSize - [dx, dy] (dy usually negative)
 * @param interval - Contour interval in meters
 * @param noDataValue - Values <= this are excluded
 * @param maxSegmentsPerLevel - Safety limit to prevent "Invalid Array Length" errors (default 500000)
 * @param maxLevels - Maximum number of contour levels to generate (default 200)
 */
export function extractContours(
  data: ArrayLike<number>,
  width: number,
  height: number,
  origin: [number, number],
  pixelSize: [number, number],
  interval: number = 5,
  noDataValue: number = -9999,
  maxSegmentsPerLevel: number = 500_000,
  maxLevels: number = 200,
): ContourExtractionResult {
  // 1. Compute stats
  let min = Infinity, max = -Infinity, sum = 0, validCells = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v <= noDataValue || isNaN(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    validCells++;
  }
  const mean = validCells > 0 ? sum / validCells : 0;
  if (validCells === 0) return { contours: [], stats: { min: 0, max: 0, mean: 0, validCells: 0 } };

  // 2. Generate threshold levels with safety limit
  let effectiveInterval = interval;
  const elevRange = max - min;
  const rawLevelCount = Math.floor(elevRange / effectiveInterval) + 1;

  // If too many levels, increase the interval automatically
  if (rawLevelCount > maxLevels) {
    effectiveInterval = elevRange / maxLevels;
    // Round up to a nice number (1, 2, 5, 10, 20, 50, ...)
    const magnitude = Math.pow(10, Math.floor(Math.log10(effectiveInterval)));
    const normalized = effectiveInterval / magnitude;
    if (normalized <= 1) effectiveInterval = magnitude;
    else if (normalized <= 2) effectiveInterval = 2 * magnitude;
    else if (normalized <= 5) effectiveInterval = 5 * magnitude;
    else effectiveInterval = 10 * magnitude;
  }

  const startLevel = Math.ceil(min / effectiveInterval) * effectiveInterval;
  const endLevel = Math.floor(max / effectiveInterval) * effectiveInterval;
  const levels: number[] = [];
  for (let l = startLevel; l <= endLevel && levels.length < maxLevels; l += effectiveInterval) {
    levels.push(l);
  }

  // 3. For very large rasters, subsample to reduce segment count
  let stepRow = 1;
  let stepCol = 1;
  const cellCount = (width - 1) * (height - 1);
  const MAX_CELLS = 2_000_000; // Limit processing to ~2M cells
  if (cellCount > MAX_CELLS) {
    const step = Math.ceil(Math.sqrt(cellCount / MAX_CELLS));
    stepRow = step;
    stepCol = step;
  }

  const [dx, dy] = pixelSize;
  const [ox, oy] = origin;
  // Adjust pixel size for subsampled grid
  const sDx = dx * stepCol;
  const sDy = dy * stepRow;

  // 4. Marching squares for each level
  const contours: ContourLine[] = [];

  for (const threshold of levels) {
    const segments: [number, number][][] = [];
    let segmentLimitReached = false;

    for (let row = 0; row < height - stepRow && !segmentLimitReached; row += stepRow) {
      for (let col = 0; col < width - stepCol && !segmentLimitReached; col += stepCol) {
        const tl = data[row * width + col];
        const trCol = Math.min(col + stepCol, width - 1);
        const brRow = Math.min(row + stepRow, height - 1);
        const tr = data[row * width + trCol];
        const br = data[brRow * width + trCol];
        const bl = data[brRow * width + col];

        // Skip cells with nodata
        if (tl <= noDataValue || tr <= noDataValue || br <= noDataValue || bl <= noDataValue) continue;
        if (isNaN(tl) || isNaN(tr) || isNaN(br) || isNaN(bl)) continue;

        // Classify corners
        let caseIndex = 0;
        if (bl >= threshold) caseIndex |= 1;
        if (br >= threshold) caseIndex |= 2;
        if (tr >= threshold) caseIndex |= 4;
        if (tl >= threshold) caseIndex |= 8;

        const edges = EDGE_TABLE[caseIndex];
        if (edges.length === 0) continue;

        // Use grid-relative positions for subsampled cells
        const cellCol = col / stepCol;
        const cellRow = row / stepRow;

        // Generate segments (2 edges per segment)
        for (let e = 0; e < edges.length; e += 2) {
          const p1 = edgePoint(cellCol, cellRow, bl, br, tr, tl, threshold, edges[e], ox, oy, sDx, sDy);
          const p2 = edgePoint(cellCol, cellRow, bl, br, tr, tl, threshold, edges[e + 1], ox, oy, sDx, sDy);
          segments.push([p1, p2]);

          if (segments.length >= maxSegmentsPerLevel) {
            segmentLimitReached = true;
            break;
          }
        }
      }
    }

    if (segments.length > 0) {
      contours.push({ elevation: threshold, segments });
    }
  }

  return {
    contours,
    stats: { min, max, mean, validCells },
  };
}
