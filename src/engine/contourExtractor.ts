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
 */
export function extractContours(
  data: ArrayLike<number>,
  width: number,
  height: number,
  origin: [number, number],
  pixelSize: [number, number],
  interval: number = 5,
  noDataValue: number = -9999,
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

  // 2. Generate threshold levels
  const startLevel = Math.ceil(min / interval) * interval;
  const endLevel = Math.floor(max / interval) * interval;
  const levels: number[] = [];
  for (let l = startLevel; l <= endLevel; l += interval) levels.push(l);

  const [dx, dy] = pixelSize;
  const [ox, oy] = origin;

  // 3. Marching squares for each level
  const contours: ContourLine[] = [];

  for (const threshold of levels) {
    const segments: [number, number][][] = [];

    for (let row = 0; row < height - 1; row++) {
      for (let col = 0; col < width - 1; col++) {
        const tl = data[row * width + col];
        const tr = data[row * width + col + 1];
        const br = data[(row + 1) * width + col + 1];
        const bl = data[(row + 1) * width + col];

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

        // Generate segments (2 edges per segment)
        for (let e = 0; e < edges.length; e += 2) {
          const p1 = edgePoint(col, row, bl, br, tr, tl, threshold, edges[e], ox, oy, dx, dy);
          const p2 = edgePoint(col, row, bl, br, tr, tl, threshold, edges[e + 1], ox, oy, dx, dy);
          segments.push([p1, p2]);
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
