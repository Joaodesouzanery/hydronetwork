/**
 * Terrain Interpolation — Snaps network nodes to topographic survey points
 * and interpolates elevation from a triangulated surface.
 *
 * Supports:
 * - Nearest-point snap within tolerance
 * - IDW (Inverse Distance Weighting) interpolation
 * - Simple Delaunay-like triangulation for barycentric interpolation
 */

import { PontoTopografico } from "./reader";

export interface SnapResult {
  nodeId: string;
  originalZ: number;
  snappedZ: number;
  snapDistance: number;
  snapPointId: string;
  method: "exact" | "nearest" | "interpolated";
}

/**
 * Find the nearest topographic point within a tolerance radius.
 * Returns the point and distance, or null if none found.
 */
export function findNearestPoint(
  x: number,
  y: number,
  surveyPoints: PontoTopografico[],
  tolerance: number = 2.0,
): { point: PontoTopografico; distance: number } | null {
  let nearest: PontoTopografico | null = null;
  let minDist = Infinity;

  for (const pt of surveyPoints) {
    const dx = pt.x - x;
    const dy = pt.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist && dist <= tolerance) {
      minDist = dist;
      nearest = pt;
    }
  }

  return nearest ? { point: nearest, distance: minDist } : null;
}

/**
 * Snap network nodes to the nearest topographic survey points.
 * Returns the snap results for each node that was successfully snapped.
 */
export function snapNodesToSurvey(
  nodes: Array<{ id: string; x: number; y: number; z: number }>,
  surveyPoints: PontoTopografico[],
  tolerance: number = 2.0,
): SnapResult[] {
  const results: SnapResult[] = [];

  for (const node of nodes) {
    const nearest = findNearestPoint(node.x, node.y, surveyPoints, tolerance);
    if (nearest) {
      results.push({
        nodeId: node.id,
        originalZ: node.z,
        snappedZ: nearest.point.cota,
        snapDistance: nearest.distance,
        snapPointId: nearest.point.id,
        method: nearest.distance < 0.01 ? "exact" : "nearest",
      });
    }
  }

  return results;
}

/**
 * IDW (Inverse Distance Weighting) interpolation.
 * Estimates elevation at (x,y) using k nearest survey points.
 */
export function interpolateIDW(
  x: number,
  y: number,
  surveyPoints: PontoTopografico[],
  k: number = 6,
  power: number = 2,
): number | null {
  if (surveyPoints.length === 0) return null;

  // Calculate distances to all points
  const distances: Array<{ cota: number; dist: number }> = [];
  for (const pt of surveyPoints) {
    const dx = pt.x - x;
    const dy = pt.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return pt.cota; // Exact match
    distances.push({ cota: pt.cota, dist });
  }

  // Sort by distance and take k nearest
  distances.sort((a, b) => a.dist - b.dist);
  const nearest = distances.slice(0, Math.min(k, distances.length));

  // IDW formula: z = Σ(wi * zi) / Σ(wi) where wi = 1/di^p
  let sumWeights = 0;
  let sumWeightedZ = 0;
  for (const n of nearest) {
    const w = 1 / Math.pow(n.dist, power);
    sumWeights += w;
    sumWeightedZ += w * n.cota;
  }

  return sumWeights > 0 ? sumWeightedZ / sumWeights : null;
}

/**
 * Snap or interpolate elevation for network nodes from survey data.
 * First tries nearest-point snap, then falls back to IDW interpolation.
 */
export function resolveElevations(
  nodes: Array<{ id: string; x: number; y: number; z: number }>,
  surveyPoints: PontoTopografico[],
  snapTolerance: number = 2.0,
): SnapResult[] {
  const results: SnapResult[] = [];

  for (const node of nodes) {
    // Try exact snap first
    const nearest = findNearestPoint(node.x, node.y, surveyPoints, snapTolerance);
    if (nearest) {
      results.push({
        nodeId: node.id,
        originalZ: node.z,
        snappedZ: nearest.point.cota,
        snapDistance: nearest.distance,
        snapPointId: nearest.point.id,
        method: nearest.distance < 0.01 ? "exact" : "nearest",
      });
      continue;
    }

    // Fallback to IDW interpolation
    const interpolated = interpolateIDW(node.x, node.y, surveyPoints);
    if (interpolated !== null) {
      results.push({
        nodeId: node.id,
        originalZ: node.z,
        snappedZ: interpolated,
        snapDistance: -1,
        snapPointId: "interpolated",
        method: "interpolated",
      });
    }
  }

  return results;
}

/**
 * Calculate installation depth: terrain elevation - network node elevation.
 */
export function calculateInstallationDepths(
  nodes: Array<{ id: string; x: number; y: number; z: number }>,
  surveyPoints: PontoTopografico[],
): Array<{ nodeId: string; terrainZ: number; networkZ: number; depth: number }> {
  const results: Array<{ nodeId: string; terrainZ: number; networkZ: number; depth: number }> = [];

  for (const node of nodes) {
    const terrainZ = interpolateIDW(node.x, node.y, surveyPoints);
    if (terrainZ !== null && node.z > 0) {
      results.push({
        nodeId: node.id,
        terrainZ,
        networkZ: node.z,
        depth: terrainZ - node.z,
      });
    }
  }

  return results;
}
