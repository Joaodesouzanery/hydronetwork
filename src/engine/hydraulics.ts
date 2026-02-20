/**
 * Hydraulic calculations for sanitation networks.
 * Manning (free flow) and Hazen-Williams (pressure).
 */

const PI = Math.PI;
const GRAVITY = 9.81;

// === Geometric Functions ===

export function areaCircular(D: number, y: number | null = null): number {
  if (y === null || y >= D) return (PI * D * D) / 4;
  if (y <= 0) return 0;
  const r = D / 2;
  const theta = 2 * Math.acos((r - y) / r);
  return (r * r * (theta - Math.sin(theta))) / 2;
}

export function perimetroMolhado(D: number, y: number | null = null): number {
  if (y === null || y >= D) return PI * D;
  if (y <= 0) return 0;
  const r = D / 2;
  const theta = 2 * Math.acos((r - y) / r);
  return r * theta;
}

export function raioHidraulico(D: number, y: number | null = null): number {
  const A = areaCircular(D, y);
  const P = perimetroMolhado(D, y);
  return P > 0 ? A / P : 0;
}

// === Manning ===

export function manningVelocity(R: number, S: number, n: number): number {
  if (R <= 0 || S <= 0 || n <= 0) return 0;
  return (1 / n) * Math.pow(R, 2 / 3) * Math.pow(S, 0.5);
}

export function manningFlow(A: number, R: number, S: number, n: number): number {
  return A * manningVelocity(R, S, n);
}

export function manningFlowCircular(
  D: number,
  S: number,
  n: number,
  yD = 1.0
): number {
  const y = yD * D;
  const A = areaCircular(D, y);
  const R = raioHidraulico(D, y);
  return manningFlow(A, R, S, n);
}

export const COEF_MANNING: Record<string, number> = {
  PVC: 0.01,
  PEAD: 0.01,
  Concreto: 0.013,
  "Ferro Fundido": 0.012,
};

// === Hazen-Williams ===

export function hazenWilliamsHeadloss(
  Q: number,
  D: number,
  L: number,
  C: number
): number {
  if (Q <= 0 || D <= 0 || L <= 0 || C <= 0) return 0;
  return (10.643 * Math.pow(Q, 1.85)) / (Math.pow(C, 1.85) * Math.pow(D, 4.87)) * L;
}

export function hazenWilliamsVelocity(Q: number, D: number): number {
  if (D <= 0) return 0;
  const A = (PI * D * D) / 4;
  return Q / A;
}

export const COEF_HAZEN_WILLIAMS: Record<string, number> = {
  PVC: 150,
  PEAD: 150,
  "Ferro Fundido Novo": 130,
  "Ferro Fundido Usado": 100,
  Concreto: 120,
};

// === Pump Power ===

export function pumpPowerKW(
  Q: number,
  dH: number,
  efficiency = 0.75
): number {
  if (Q <= 0 || dH <= 0 || efficiency <= 0) return 0;
  return (1000 * GRAVITY * Q * dH) / (efficiency * 1000);
}

export function pumpPowerCV(Q: number, dH: number, efficiency = 0.75): number {
  return pumpPowerKW(Q, dH, efficiency) / 0.7355;
}

// === UTM Conversion ===

const K0 = 0.9996;
const E_SQUARED = 0.00669437999014;
const EQUATORIAL_RADIUS = 6378137.0;

/**
 * Strict UTM check: Easting 100k-900k, Northing > 1M.
 * Previous version accepted Northing > 100k which caught local/model coords.
 */
export function isUTM(x: number, y: number): boolean {
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  return absX >= 100000 && absX <= 900000 && absY >= 1000000 && absY <= 10000000;
}

/**
 * Loose UTM check for edge cases (when batch analysis confirms UTM).
 * Accepts wider northing range for coordinates with unusual values.
 */
export function isUTMLenient(x: number, y: number): boolean {
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  return absX >= 100000 && absX <= 900000 && absY >= 100000;
}

/**
 * Check if coordinates look like geographic lat/lng
 * x = longitude (-180 to 180), y = latitude (-90 to 90)
 */
export function isLatLng(x: number, y: number): boolean {
  return Math.abs(x) <= 180 && Math.abs(y) <= 90;
}

// Global override for UTM zone - can be set by user
let globalUtmZone: number | undefined;
export function setGlobalUtmZone(zone: number | undefined) { globalUtmZone = zone; }
export function getGlobalUtmZone() { return globalUtmZone; }

export function utmToLatLng(
  easting: number,
  northing: number,
  zone = 23,
  hemisphere: "N" | "S" = "S"
): { lat: number; lng: number } {
  const x = easting - 500000;
  const y = hemisphere === "S" ? northing - 10000000 : northing;

  const m = y / K0;
  const mu =
    m / (EQUATORIAL_RADIUS * (1 - E_SQUARED / 4 - (3 * E_SQUARED ** 2) / 64));

  const e1 =
    (1 - Math.sqrt(1 - E_SQUARED)) / (1 + Math.sqrt(1 - E_SQUARED));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  const n1 = EQUATORIAL_RADIUS / Math.sqrt(1 - E_SQUARED * sinPhi1 ** 2);
  const r1 =
    (EQUATORIAL_RADIUS * (1 - E_SQUARED)) /
    (1 - E_SQUARED * sinPhi1 ** 2) ** 1.5;
  const d = x / (n1 * K0);

  const PI = Math.PI;

  const lat =
    phi1 -
    ((n1 * tanPhi1) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * tanPhi1 ** 2) * d ** 4) / 24 +
        ((61 + 90 * tanPhi1 ** 2) * d ** 6) / 720);

  const lng =
    ((zone - 1) * 6 - 180 + 3) * (PI / 180) +
    (d -
      ((1 + 2 * tanPhi1 ** 2) * d ** 3) / 6 +
      ((5 - 2 * tanPhi1 ** 2 + 28 * tanPhi1 ** 2) * d ** 5) / 120) /
      cosPhi1;

  return {
    lat: (lat * 180) / PI,
    lng: (lng * 180) / PI,
  };
}

/**
 * Auto-detect UTM zone by testing each Brazil zone (18-25).
 * Returns the zone whose central meridian best matches the converted longitude.
 */
export function detectUTMZone(easting: number, northing: number, overrideZone?: number): { zone: number; hemisphere: "N" | "S" } {
  const hemisphere: "N" | "S" = northing < 10000000 ? "S" : "N";
  if (overrideZone) return { zone: overrideZone, hemisphere };

  // Try each Brazil UTM zone and find the one where the result falls within zone bounds
  for (const zone of [18, 19, 20, 21, 22, 23, 24, 25]) {
    const result = utmToLatLng(easting, northing, zone, hemisphere);
    if (!isFinite(result.lat) || !isFinite(result.lng)) continue;
    // Check if result is within Brazil's bounding box (with margin)
    if (result.lat < -35 || result.lat > 7) continue;
    if (result.lng < -75 || result.lng > -33) continue;
    // Check if longitude falls within this zone's range (6° wide)
    const centralMeridian = (zone - 1) * 6 - 180 + 3;
    if (Math.abs(result.lng - centralMeridian) <= 3.5) {
      return { zone, hemisphere };
    }
  }

  return { zone: 23, hemisphere };
}

// ════════════════════════════════════════
// BATCH CRS DETECTION
// Analyzes ALL points together for consistent coordinate conversion
// ════════════════════════════════════════

export type DetectedCRS =
  | { type: "utm"; zone: number; hemisphere: "N" | "S" }
  | { type: "utm_swapped"; zone: number; hemisphere: "N" | "S" } // x=northing, y=easting
  | { type: "latLng"; convention: "xy" }  // x=longitude, y=latitude
  | { type: "latLng"; convention: "yx" }  // x=latitude, y=longitude
  | { type: "local"; baseLatLng: [number, number] }
  | { type: "unknown" };

/**
 * Analyze a batch of coordinates to detect the coordinate reference system.
 * This is MUCH more reliable than per-point detection because it uses
 * the statistical distribution of ALL coordinates.
 */
export function detectBatchCRS(points: { x: number; y: number }[]): DetectedCRS {
  const valid = points.filter(p => isFinite(p.x) && isFinite(p.y) && (p.x !== 0 || p.y !== 0));
  if (valid.length === 0) return { type: "unknown" };

  const xs = valid.map(p => p.x);
  const ys = valid.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;

  // 1. Check if coordinates are strictly UTM (easting=x, northing=y)
  //    UTM Easting: 100k-900k, Northing for Brazil: ~6.3M-10M (southern), >10M (northern)
  const allStrictUTM = valid.every(p => isUTM(p.x, p.y));
  if (allStrictUTM) {
    const sample = valid[0];
    const detected = detectUTMZone(sample.x, sample.y, globalUtmZone);
    return { type: "utm", zone: detected.zone, hemisphere: detected.hemisphere };
  }

  // 2. Check if x/y are swapped UTM (x=northing, y=easting)
  const allSwappedUTM = valid.every(p => isUTM(p.y, p.x));
  if (allSwappedUTM) {
    const sample = valid[0];
    const detected = detectUTMZone(sample.y, sample.x, globalUtmZone);
    return { type: "utm_swapped", zone: detected.zone, hemisphere: detected.hemisphere };
  }

  // 3. Check if all points look like geographic lat/lng (x=lng, y=lat)
  //    For Brazil: lng ∈ [-75, -34], lat ∈ [-34, 6]
  const allLatLngXY = valid.every(p => Math.abs(p.x) <= 180 && Math.abs(p.y) <= 90);
  if (allLatLngXY) {
    // Determine which convention: is x=longitude or x=latitude?
    // For Brazil, longitude is roughly -75 to -34, latitude is -34 to 6
    const xLooksLikeLng = minX >= -180 && maxX <= 180 && (minX < -30 || maxX > 10);
    const yLooksLikeLat = minY >= -90 && maxY <= 90;
    if (xLooksLikeLng && yLooksLikeLat) {
      return { type: "latLng", convention: "xy" }; // x=lng, y=lat (standard)
    }
    // Check if swapped
    const xLooksLikeLat = minX >= -90 && maxX <= 90;
    const yLooksLikeLng = minY >= -180 && maxY <= 180 && (minY < -30 || maxY > 10);
    if (xLooksLikeLat && yLooksLikeLng) {
      return { type: "latLng", convention: "yx" }; // x=lat, y=lng
    }
    // Default: x=lng, y=lat
    return { type: "latLng", convention: "xy" };
  }

  // 4. Check if all are lat/lng with coordinates swapped
  const allLatLngYX = valid.every(p => Math.abs(p.y) <= 180 && Math.abs(p.x) <= 90);
  if (allLatLngYX) {
    return { type: "latLng", convention: "yx" };
  }

  // 5. Check if coordinates look like lenient UTM (easting OK, northing between 100k and 1M)
  //    This handles edge cases where northing is < 1M (very close to equator in N hemisphere)
  const allLenientUTM = valid.every(p => isUTMLenient(p.x, p.y));
  if (allLenientUTM && minY > 50000) {
    // Try conversion with each zone to verify
    const sample = valid[0];
    for (const zone of [18, 19, 20, 21, 22, 23, 24, 25]) {
      const hemisphere: "N" | "S" = sample.y < 10000000 ? "S" : "N";
      const result = utmToLatLng(sample.x, sample.y, zone, hemisphere);
      if (isFinite(result.lat) && isFinite(result.lng) &&
          result.lat >= -35 && result.lat <= 7 &&
          result.lng >= -75 && result.lng <= -33) {
        return { type: "utm", zone, hemisphere };
      }
    }
  }

  // 6. Local/model coordinates (small numbers, or numbers that don't match any system)
  //    Use a reasonable default location (São Paulo) as base
  const maxDim = Math.max(rangeX, rangeY, Math.abs(maxX), Math.abs(maxY), Math.abs(minX), Math.abs(minY));
  if (maxDim < 100000) {
    return { type: "local", baseLatLng: [-23.55, -46.63] };
  }

  // 7. Large numbers that don't match UTM - could be IFC in mm, local system, etc.
  //    Treat as local/model coordinates scaled to meters
  return { type: "local", baseLatLng: [-23.55, -46.63] };
}

/**
 * Convert a single coordinate using a pre-detected CRS.
 * This ensures ALL points from the same import use the SAME conversion.
 */
export function getMapCoordinatesWithCRS(x: number, y: number, crs: DetectedCRS): [number, number] {
  switch (crs.type) {
    case "utm": {
      const { lat, lng } = utmToLatLng(x, y, crs.zone, crs.hemisphere);
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return [lat, lng];
      }
      return [-23.55, -46.63];
    }
    case "utm_swapped": {
      // x and y are swapped: x=northing, y=easting
      const { lat, lng } = utmToLatLng(y, x, crs.zone, crs.hemisphere);
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return [lat, lng];
      }
      return [-23.55, -46.63];
    }
    case "latLng": {
      if (crs.convention === "xy") return [y, x]; // x=lng, y=lat → [lat, lng]
      return [x, y]; // x=lat, y=lng → [lat, lng]
    }
    case "local": {
      const [baseLat, baseLng] = crs.baseLatLng;
      const cosBase = Math.cos(baseLat * Math.PI / 180);
      // Scale: 1 degree ≈ 111320m at equator
      // For local/model coordinates, detect if they might be in mm
      let scaleX = x;
      let scaleY = y;
      // If coordinates are very large (>100k), they might be in mm → convert to meters
      if (Math.abs(x) > 100000 || Math.abs(y) > 100000) {
        scaleX = x / 1000;
        scaleY = y / 1000;
      }
      return [
        baseLat + scaleY / 111320,
        baseLng + scaleX / (111320 * cosBase),
      ];
    }
    default:
      return [y, x];
  }
}

/**
 * Legacy per-point conversion. Uses batch detection internally on a single point.
 * Prefer detectBatchCRS + getMapCoordinatesWithCRS for multi-point scenarios.
 */
export function getMapCoordinates(x: number, y: number): [number, number] {
  const crs = detectBatchCRS([{ x, y }]);
  return getMapCoordinatesWithCRS(x, y, crs);
}
