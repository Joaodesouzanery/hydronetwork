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

export function isUTM(x: number, y: number): boolean {
  return x > 1000 && x < 1000000 && y > 100000;
}

/**
 * Auto-detect UTM zone from easting/northing.
 * For Brazil, typical zones are 18-25 (SIRGAS 2000).
 * We use the northing to determine hemisphere and
 * default to zone 23 (covers most of SP, MG, RJ, ES).
 */
export function detectUTMZone(x: number, y: number): { zone: number; hemisphere: "N" | "S" } {
  // Northing > 10,000,000 is impossible - it's southern hemisphere with offset
  const hemisphere: "N" | "S" = y < 10000000 ? "S" : "N";
  // For Brazil, most common zones:
  // Zone 22: ~51°W to ~45°W (PR, SC, RS, MS, west SP)
  // Zone 23: ~45°W to ~39°W (SP, MG, RJ, ES, BA, GO)
  // Zone 24: ~39°W to ~33°W (NE, SE coast)
  // Default to 23 as it covers the most populated areas
  return { zone: 23, hemisphere };
}

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

export function getMapCoordinates(x: number, y: number): [number, number] {
  if (isUTM(x, y)) {
    const { zone, hemisphere } = detectUTMZone(x, y);
    const { lat, lng } = utmToLatLng(x, y, zone, hemisphere);
    return [lat, lng];
  }
  // Assume lat/lng already
  return [y, x];
}
