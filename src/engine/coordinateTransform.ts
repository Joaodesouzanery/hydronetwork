/**
 * Coordinate Transformation Engine
 * Handles reprojection between CRS systems and bulk coordinate operations.
 * Supports: UTM (all zones/datums), Geographic (WGS84/SIRGAS2000), offsets.
 */

import { CRSDefinition, CRS_CATALOG } from "@/core/spatial/ProjectCRS";
import { utmToLatLng, isUTM } from "./hydraulics";

// ════════════════════════════════════════
// UTM Constants
// ════════════════════════════════════════

const K0 = 0.9996;
const E_SQUARED = 0.00669437999014;
const EQUATORIAL_RADIUS = 6378137.0;

// SAD69 ellipsoid parameters (different from WGS84/SIRGAS2000)
const SAD69_EQUATORIAL_RADIUS = 6378160.0;
const SAD69_E_SQUARED = 0.006694542;

// ════════════════════════════════════════
// DATUM DEFINITIONS
// ════════════════════════════════════════

export type DatumType = "SIRGAS2000" | "WGS84" | "SAD69";

export interface DatumParams {
  a: number;       // semi-major axis
  e2: number;      // eccentricity squared
  label: string;
}

export const DATUMS: Record<DatumType, DatumParams> = {
  SIRGAS2000: { a: EQUATORIAL_RADIUS, e2: E_SQUARED, label: "SIRGAS 2000" },
  WGS84: { a: EQUATORIAL_RADIUS, e2: E_SQUARED, label: "WGS 84" },
  SAD69: { a: SAD69_EQUATORIAL_RADIUS, e2: SAD69_E_SQUARED, label: "SAD 69" },
};

// ════════════════════════════════════════
// UTM ZONES FOR BRAZIL
// ════════════════════════════════════════

export interface UTMZoneInfo {
  zone: number;
  hemisphere: "N" | "S";
  centralMeridian: number;
  label: string;
  epsgSirgas: string;
  epsgWgs84: string;
}

export const BRAZIL_UTM_ZONES: UTMZoneInfo[] = [
  { zone: 18, hemisphere: "S", centralMeridian: -75, label: "18S", epsgSirgas: "EPSG:31978", epsgWgs84: "EPSG:32718" },
  { zone: 19, hemisphere: "S", centralMeridian: -69, label: "19S", epsgSirgas: "EPSG:31979", epsgWgs84: "EPSG:32719" },
  { zone: 20, hemisphere: "S", centralMeridian: -63, label: "20S", epsgSirgas: "EPSG:31980", epsgWgs84: "EPSG:32720" },
  { zone: 21, hemisphere: "S", centralMeridian: -57, label: "21S", epsgSirgas: "EPSG:31981", epsgWgs84: "EPSG:32721" },
  { zone: 22, hemisphere: "S", centralMeridian: -51, label: "22S", epsgSirgas: "EPSG:31982", epsgWgs84: "EPSG:32722" },
  { zone: 23, hemisphere: "S", centralMeridian: -45, label: "23S", epsgSirgas: "EPSG:31983", epsgWgs84: "EPSG:32723" },
  { zone: 24, hemisphere: "S", centralMeridian: -39, label: "24S", epsgSirgas: "EPSG:31984", epsgWgs84: "EPSG:32724" },
  { zone: 25, hemisphere: "S", centralMeridian: -33, label: "25S", epsgSirgas: "EPSG:31985", epsgWgs84: "EPSG:32725" },
];

// ════════════════════════════════════════
// COORDINATE TYPE DETECTION
// ════════════════════════════════════════

export type CoordinateSystemType = "geographic" | "utm" | "custom";

export interface ImportCRSConfig {
  type: CoordinateSystemType;
  datum: DatumType;
  utmZone?: number;
  hemisphere?: "N" | "S";
  epsgCode?: string;
}

/**
 * Validate UTM coordinates - returns warnings if out of expected range.
 */
export function validateUTMRange(x: number, y: number): { valid: boolean; warning?: string } {
  const validX = x >= 100000 && x <= 900000;
  const validY = y >= 1000000 && y <= 10000000;
  if (validX && validY) return { valid: true };
  const issues: string[] = [];
  if (!validX) issues.push(`X=${x.toFixed(0)} fora da faixa 100.000-900.000`);
  if (!validY) issues.push(`Y=${y.toFixed(0)} fora da faixa 1.000.000-10.000.000`);
  return {
    valid: false,
    warning: `Coordenadas fora da faixa UTM esperada. ${issues.join("; ")}. Possível erro de CRS ou escala.`
  };
}

/**
 * Auto-detect coordinate system from a sample of points.
 */
export function autoDetectCRS(points: { x: number; y: number }[]): ImportCRSConfig | null {
  if (points.length === 0) return null;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Check if geographic (lat/lng)
  if (Math.abs(minX) <= 180 && Math.abs(maxX) <= 180 && Math.abs(minY) <= 90 && Math.abs(maxY) <= 90) {
    return { type: "geographic", datum: "WGS84" };
  }

  // Check if UTM
  if (minX >= 100000 && maxX <= 900000 && minY >= 1000000 && maxY <= 10000000) {
    // Try to detect zone
    const sampleX = xs[0];
    const sampleY = ys[0];
    for (const z of BRAZIL_UTM_ZONES) {
      const result = utmToLatLng(sampleX, sampleY, z.zone, z.hemisphere);
      if (isFinite(result.lat) && isFinite(result.lng) &&
          result.lat >= -35 && result.lat <= 7 &&
          result.lng >= -75 && result.lng <= -33) {
        const centralMeridian = (z.zone - 1) * 6 - 180 + 3;
        if (Math.abs(result.lng - centralMeridian) <= 3.5) {
          return { type: "utm", datum: "SIRGAS2000", utmZone: z.zone, hemisphere: z.hemisphere };
        }
      }
    }
    return { type: "utm", datum: "SIRGAS2000", utmZone: 23, hemisphere: "S" };
  }

  return null;
}

// ════════════════════════════════════════
// LAT/LNG TO UTM CONVERSION
// ════════════════════════════════════════

export function latLngToUtm(
  lat: number,
  lng: number,
  zone?: number,
  datum: DatumType = "SIRGAS2000"
): { easting: number; northing: number; zone: number; hemisphere: "N" | "S" } {
  const d = DATUMS[datum];
  const hemisphere: "N" | "S" = lat >= 0 ? "N" : "S";
  const utmZone = zone ?? Math.floor((lng + 180) / 6) + 1;

  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180;
  const centralMeridian = ((utmZone - 1) * 6 - 180 + 3) * Math.PI / 180;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const e1sq = d.e2 / (1 - d.e2);
  const N = d.a / Math.sqrt(1 - d.e2 * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = e1sq * cosLat * cosLat;
  const A = cosLat * (lngRad - centralMeridian);

  const M = d.a * (
    (1 - d.e2 / 4 - 3 * d.e2 * d.e2 / 64 - 5 * d.e2 * d.e2 * d.e2 / 256) * latRad
    - (3 * d.e2 / 8 + 3 * d.e2 * d.e2 / 32 + 45 * d.e2 * d.e2 * d.e2 / 1024) * Math.sin(2 * latRad)
    + (15 * d.e2 * d.e2 / 256 + 45 * d.e2 * d.e2 * d.e2 / 1024) * Math.sin(4 * latRad)
    - (35 * d.e2 * d.e2 * d.e2 / 3072) * Math.sin(6 * latRad)
  );

  let easting = K0 * N * (A + (1 - T + C) * A * A * A / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * e1sq) * A * A * A * A * A / 120) + 500000;

  let northing = K0 * (M + N * tanLat * (A * A / 2
    + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * e1sq) * A * A * A * A * A * A / 720));

  if (hemisphere === "S") northing += 10000000;

  return { easting, northing, zone: utmZone, hemisphere };
}

// ════════════════════════════════════════
// REPROJECTION
// ════════════════════════════════════════

export interface TransformResult {
  x: number;
  y: number;
  z: number;
}

/**
 * Transform a single coordinate from source CRS to target CRS.
 */
export function transformCoordinate(
  x: number, y: number, z: number,
  source: ImportCRSConfig,
  target: ImportCRSConfig
): TransformResult {
  // Same CRS - no transform needed
  if (source.type === target.type && source.utmZone === target.utmZone &&
      source.hemisphere === target.hemisphere && source.datum === target.datum) {
    return { x, y, z };
  }

  // Step 1: Convert source to WGS84 lat/lng
  let lat: number, lng: number;

  if (source.type === "geographic") {
    lat = y;
    lng = x;
  } else if (source.type === "utm") {
    const result = utmToLatLng(x, y, source.utmZone || 23, source.hemisphere || "S");
    lat = result.lat;
    lng = result.lng;
  } else {
    return { x, y, z };
  }

  // Step 2: Convert to target CRS
  if (target.type === "geographic") {
    return { x: lng, y: lat, z };
  } else if (target.type === "utm") {
    const result = latLngToUtm(lat, lng, target.utmZone, target.datum);
    return { x: result.easting, y: result.northing, z };
  }

  return { x, y, z };
}

/**
 * Bulk transform all coordinates.
 */
export function transformCoordinates(
  points: { x: number; y: number; z: number }[],
  source: ImportCRSConfig,
  target: ImportCRSConfig
): TransformResult[] {
  return points.map(p => transformCoordinate(p.x, p.y, p.z, source, target));
}

// ════════════════════════════════════════
// OFFSET/DISPLACEMENT OPERATIONS
// ════════════════════════════════════════

export interface OffsetResult {
  deltaX: number;
  deltaY: number;
  points: { x: number; y: number; z: number }[];
}

/**
 * Calculate and apply offset from a single reference point.
 * wrongPos: where the point currently is
 * correctPos: where it should be
 */
export function calculateOffset(
  wrongPos: { x: number; y: number },
  correctPos: { x: number; y: number }
): { deltaX: number; deltaY: number } {
  return {
    deltaX: correctPos.x - wrongPos.x,
    deltaY: correctPos.y - wrongPos.y,
  };
}

/**
 * Apply an offset to all points.
 */
export function applyOffset(
  points: { x: number; y: number; z: number }[],
  deltaX: number,
  deltaY: number
): { x: number; y: number; z: number }[] {
  return points.map(p => ({
    x: p.x + deltaX,
    y: p.y + deltaY,
    z: p.z,
  }));
}

/**
 * Calculate offset from two reference point pairs (more precise).
 * Uses the average of both offsets for better accuracy.
 */
export function calculateTwoPointOffset(
  wrong1: { x: number; y: number },
  correct1: { x: number; y: number },
  wrong2: { x: number; y: number },
  correct2: { x: number; y: number }
): { deltaX: number; deltaY: number } {
  const dx1 = correct1.x - wrong1.x;
  const dy1 = correct1.y - wrong1.y;
  const dx2 = correct2.x - wrong2.x;
  const dy2 = correct2.y - wrong2.y;
  return {
    deltaX: (dx1 + dx2) / 2,
    deltaY: (dy1 + dy2) / 2,
  };
}

/**
 * Get the CRS config from a CRSDefinition (from the catalog).
 */
export function crsDefinitionToConfig(def: CRSDefinition): ImportCRSConfig {
  if (def.unit === "deg") {
    return { type: "geographic", datum: "WGS84" };
  }
  return {
    type: "utm",
    datum: def.code.includes("319") ? "SIRGAS2000" : "WGS84",
    utmZone: def.utmZone,
    hemisphere: def.hemisphere,
  };
}

/**
 * Get a user-friendly label for an ImportCRSConfig.
 */
export function getCRSLabel(config: ImportCRSConfig): string {
  if (config.type === "geographic") {
    return `Geográfico (${config.datum})`;
  }
  if (config.type === "utm") {
    return `UTM ${config.utmZone}${config.hemisphere} - ${DATUMS[config.datum].label}`;
  }
  return "Personalizado";
}
