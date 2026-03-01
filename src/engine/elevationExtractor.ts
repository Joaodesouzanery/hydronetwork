/**
 * Elevation Extractor — Samples elevation from raster data (GeoTIFF DEM/DTM)
 * for spatial network nodes, and propagates terrain elevations to edges.
 *
 * Uses bilinear interpolation for sub-pixel accuracy and integrates with
 * the SpatialCore node/edge store for automatic topology updates.
 */

import { getRasterGrid } from "./rasterStore";
import type { TifRasterGrid } from "./tifReader";
import {
  getSpatialProject,
  recalculateEdge,
  getConnectedEdges,
  type SpatialNode,
} from "@/core/spatial";

// ══════════════════════════════════════
// Elevation sampling (bilinear interpolation)
// ══════════════════════════════════════

/**
 * Sample an elevation value from the currently loaded raster grid at (x, y).
 *
 * Uses bilinear interpolation across the 4 surrounding pixels for
 * sub-pixel accuracy. Returns null if no raster is loaded or if the
 * coordinates fall outside the raster extent.
 */
export function sampleElevation(x: number, y: number): number | null {
  const rasterInfo = getRasterGrid();
  if (!rasterInfo) return null;

  const { grid, meta } = rasterInfo;
  const { data, origin, pixelSize } = grid;
  const { width, height, noDataValue } = meta;

  // Calculate continuous pixel position
  const col = (x - origin[0]) / pixelSize[0];
  const row = (y - origin[1]) / pixelSize[1];

  // Bounds check: need at least a 1-pixel margin for bilinear interpolation
  if (col < 0 || col >= width - 1 || row < 0 || row >= height - 1) {
    return null;
  }

  // Integer pixel coordinates for the 4 surrounding cells
  const col0 = Math.floor(col);
  const row0 = Math.floor(row);
  const col1 = col0 + 1;
  const row1 = row0 + 1;

  // Fractional offsets within the cell
  const dx = col - col0;
  const dy = row - row0;

  // Sample the 4 corner values
  const q00 = data[row0 * width + col0]; // top-left
  const q10 = data[row0 * width + col1]; // top-right
  const q01 = data[row1 * width + col0]; // bottom-left
  const q11 = data[row1 * width + col1]; // bottom-right

  // Check for nodata in any of the 4 corners
  if (noDataValue !== undefined) {
    if (q00 === noDataValue || q10 === noDataValue || q01 === noDataValue || q11 === noDataValue) {
      return null;
    }
  }
  if (isNaN(q00) || isNaN(q10) || isNaN(q01) || isNaN(q11)) {
    return null;
  }

  // Bilinear interpolation
  const elevation =
    q00 * (1 - dx) * (1 - dy) +
    q10 * dx * (1 - dy) +
    q01 * (1 - dx) * dy +
    q11 * dx * dy;

  return elevation;
}

// ══════════════════════════════════════
// Batch node elevation fill
// ══════════════════════════════════════

/**
 * Fill terrain elevation (z) for spatial nodes by sampling the loaded raster.
 *
 * If `nodeIds` is provided, only those nodes are updated. Otherwise all nodes
 * in the project are processed.
 *
 * For nodes that have a `cotaFundo` (invert elevation), the `profundidade`
 * (depth) is recalculated as z - cotaFundo.
 *
 * @returns Counts of updated/skipped nodes and a noRaster flag.
 */
export function fillNodeElevations(nodeIds?: string[]): {
  updated: number;
  skipped: number;
  noRaster: boolean;
} {
  const rasterInfo = getRasterGrid();
  if (!rasterInfo) {
    return { updated: 0, skipped: 0, noRaster: true };
  }

  const project = getSpatialProject();
  let updated = 0;
  let skipped = 0;

  // Determine which nodes to process
  const targetNodes: SpatialNode[] = nodeIds
    ? nodeIds
        .map((id) => project.nodes.get(id))
        .filter((n): n is SpatialNode => n !== undefined)
    : Array.from(project.nodes.values());

  for (const node of targetNodes) {
    const elevation = sampleElevation(node.x, node.y);
    if (elevation !== null) {
      node.z = elevation;

      // Recalculate depth if invert elevation is known
      if (node.cotaFundo !== undefined) {
        node.profundidade = node.z - node.cotaFundo;
      }

      updated++;
    } else {
      skipped++;
    }
  }

  return { updated, skipped, noRaster: false };
}

// ══════════════════════════════════════
// Batch edge elevation fill
// ══════════════════════════════════════

/**
 * Fill edge terrain elevations from their start/end node z-values.
 *
 * Sets edge properties:
 * - CTM (cotaTerreno montante) = startNode.z
 * - CTJ (cotaTerreno jusante) = endNode.z
 *
 * After setting elevations, calls `recalculateEdge()` to update
 * comprimento (length) and declividade (slope).
 *
 * @returns Count of updated edges.
 */
export function fillEdgeElevations(edgeIds?: string[]): { updated: number } {
  const project = getSpatialProject();
  let updated = 0;

  // Determine which edges to process
  const targetEdges = edgeIds
    ? edgeIds
        .map((id) => project.edges.get(id))
        .filter((e) => e !== undefined)
    : Array.from(project.edges.values());

  for (const edge of targetEdges) {
    const startNode = project.nodes.get(edge.startNodeId);
    const endNode = project.nodes.get(edge.endNodeId);

    if (!startNode || !endNode) continue;

    // Set terrain elevations on edge properties
    edge.properties.CTM = startNode.z;
    edge.properties.CTJ = endNode.z;

    // Recalculate comprimento and declividade from node positions
    recalculateEdge(edge.id);

    updated++;
  }

  return { updated };
}
