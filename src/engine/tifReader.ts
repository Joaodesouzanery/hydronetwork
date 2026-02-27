/**
 * TIF/GeoTIFF Reader — Converts raster elevation data (DEM/DTM) into topographic points.
 *
 * Uses the geotiff library to read GeoTIFF files and extract:
 * - Pixel values as elevation (cota)
 * - Geo-referenced coordinates from GeoTIFF transform
 * - CRS info from GeoKeys
 *
 * Supports sampling to avoid generating millions of points from high-res rasters.
 */

import { fromArrayBuffer, GeoTIFF } from "geotiff";

export interface TifRasterGrid {
  data: Float32Array | Float64Array | Int16Array | Uint16Array;
  origin: [number, number];
  pixelSize: [number, number];
}

export interface TifParseResult {
  points: Array<{ id: string; x: number; y: number; cota: number }>;
  bbox?: { minX: number; maxX: number; minY: number; maxY: number };
  width: number;
  height: number;
  crs?: { epsg?: number; description?: string };
  noDataValue?: number;
  resolution?: { x: number; y: number };
  grid?: TifRasterGrid;
}

/**
 * Parse a GeoTIFF ArrayBuffer and extract elevation points.
 *
 * @param buffer - The GeoTIFF file as ArrayBuffer
 * @param maxPoints - Maximum number of points to generate (samples uniformly). Default 10000.
 * @param noDataThreshold - Values below this are treated as nodata. Default -9999.
 */
export async function parseGeoTIFF(
  buffer: ArrayBuffer,
  maxPoints: number = 10000,
  noDataThreshold: number = -9999,
  includeGrid: boolean = false,
): Promise<TifParseResult> {
  const tiff: GeoTIFF = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();

  // Get geo-transform (origin + pixel size)
  const origin = image.getOrigin();   // [x, y, z]
  const resolution = image.getResolution(); // [xRes, yRes, zRes]

  // GeoKeys for CRS
  const geoKeys = image.getGeoKeys();
  const epsg = geoKeys?.ProjectedCSTypeGeoKey || geoKeys?.GeographicTypeGeoKey;

  // Read raster data (first band = elevation)
  const rasters = await image.readRasters();
  const data = rasters[0] as Float32Array | Float64Array | Int16Array | Uint16Array;

  // nodata value from metadata
  const fileNoData = image.getFileDirectory()?.GDAL_NODATA;
  const noDataValue = fileNoData != null ? parseFloat(String(fileNoData)) : noDataThreshold;

  // Calculate sample step to limit points
  const totalPixels = width * height;
  const step = totalPixels > maxPoints ? Math.ceil(Math.sqrt(totalPixels / maxPoints)) : 1;

  const points: TifParseResult["points"] = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let pointCounter = 0;

  for (let row = 0; row < height; row += step) {
    for (let col = 0; col < width; col += step) {
      const idx = row * width + col;
      const elevation = data[idx];

      // Skip nodata values
      if (elevation <= noDataValue || isNaN(elevation)) continue;

      // Convert pixel position to geographic/projected coordinates
      const x = origin[0] + col * resolution[0];
      const y = origin[1] + row * resolution[1]; // resolution[1] is usually negative

      points.push({
        id: `TIF_P${++pointCounter}`,
        x,
        y,
        cota: elevation,
      });

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  const result: TifParseResult = {
    points,
    bbox: points.length > 0 ? { minX, maxX, minY, maxY } : undefined,
    width,
    height,
    crs: epsg ? { epsg, description: `EPSG:${epsg}` } : undefined,
    noDataValue,
    resolution: { x: Math.abs(resolution[0]), y: Math.abs(resolution[1]) },
  };

  if (includeGrid) {
    result.grid = {
      data: data as Float32Array | Float64Array,
      origin: [origin[0], origin[1]],
      pixelSize: [resolution[0], resolution[1]],
    };
  }

  return result;
}

/**
 * Convert TIF points to InpParsed-compatible nodes (no edges for raster).
 */
export function tifPointsToInternal(points: TifParseResult["points"]): {
  nodes: Array<{ id: string; x: number; y: number; z: number; tipo: string; properties: Record<string, any> }>;
  edges: Array<any>;
} {
  return {
    nodes: points.map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.cota,
      tipo: "generic",
      properties: { _source: "GeoTIFF", cota: p.cota },
    })),
    edges: [],
  };
}
