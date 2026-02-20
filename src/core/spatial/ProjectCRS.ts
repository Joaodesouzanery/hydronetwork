/**
 * Project CRS — Coordinate Reference System definitions and management.
 * CRS is MANDATORY — nothing enters the system without a defined CRS.
 */

export interface CRSDefinition {
  code: string;       // e.g. "EPSG:31983"
  name: string;       // e.g. "SIRGAS 2000 / UTM 23S"
  unit: "m" | "deg";
  utmZone?: number;
  hemisphere?: "N" | "S";
}

export const CRS_CATALOG: CRSDefinition[] = [
  { code: "EPSG:31978", name: "SIRGAS 2000 / UTM 18S", unit: "m", utmZone: 18, hemisphere: "S" },
  { code: "EPSG:31979", name: "SIRGAS 2000 / UTM 19S", unit: "m", utmZone: 19, hemisphere: "S" },
  { code: "EPSG:31980", name: "SIRGAS 2000 / UTM 20S", unit: "m", utmZone: 20, hemisphere: "S" },
  { code: "EPSG:31981", name: "SIRGAS 2000 / UTM 21S", unit: "m", utmZone: 21, hemisphere: "S" },
  { code: "EPSG:31982", name: "SIRGAS 2000 / UTM 22S", unit: "m", utmZone: 22, hemisphere: "S" },
  { code: "EPSG:31983", name: "SIRGAS 2000 / UTM 23S", unit: "m", utmZone: 23, hemisphere: "S" },
  { code: "EPSG:31984", name: "SIRGAS 2000 / UTM 24S", unit: "m", utmZone: 24, hemisphere: "S" },
  { code: "EPSG:31985", name: "SIRGAS 2000 / UTM 25S", unit: "m", utmZone: 25, hemisphere: "S" },
  { code: "EPSG:4326", name: "WGS 84 (Lat/Long)", unit: "deg" },
  { code: "EPSG:4674", name: "SIRGAS 2000 Geográfico", unit: "deg" },
];

export interface ProjectSettings {
  crs: CRSDefinition;
  defaultUnit: "m";
  tolerance: number;       // Snap tolerance in meters (default: 0.01)
  numericFormat: "brazilian" | "american" | "auto";
}

export function detectCRSFromCoordinates(x: number, y: number): CRSDefinition | null {
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  // UTM coordinates
  if (absX > 100000 && absX < 999999 && absY > 100000) {
    return CRS_CATALOG.find(c => c.code === "EPSG:31983") || null;
  }
  // Geographic
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
    return CRS_CATALOG.find(c => c.code === "EPSG:4326") || null;
  }
  return null;
}

export function getDefaultCRS(): CRSDefinition {
  return CRS_CATALOG.find(c => c.code === "EPSG:31983")!;
}

export function findCRS(code: string): CRSDefinition | undefined {
  return CRS_CATALOG.find(c => c.code === code);
}
