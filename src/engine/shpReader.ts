/**
 * SHP Reader — Parses ESRI Shapefile (.shp) into internal model.
 * Uses the shpjs library to handle binary SHP + DBF parsing.
 *
 * Outputs GeoJSON-like features which are then converted to InpParsed nodes/edges.
 */

import shp from "shpjs";

export interface ShpFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: any;
  };
  properties: Record<string, any>;
}

export interface ShpParseResult {
  features: ShpFeature[];
  bbox?: { minX: number; maxX: number; minY: number; maxY: number };
  crs?: string;
}

/**
 * Parse a .shp (or .zip containing .shp/.dbf/.prj) ArrayBuffer into GeoJSON features.
 */
export async function parseSHPBuffer(buffer: ArrayBuffer): Promise<ShpParseResult> {
  const geojson = await shp(buffer) as any;

  // shpjs can return a single FeatureCollection or an array of them (for zipped multi-layer)
  let features: ShpFeature[] = [];
  if (Array.isArray(geojson)) {
    for (const fc of geojson) {
      if (fc && fc.features) {
        features = features.concat(fc.features);
      }
    }
  } else if (geojson && geojson.features) {
    features = geojson.features;
  } else if (geojson && geojson.type === "Feature") {
    features = [geojson];
  }

  // Compute bbox
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let hasBbox = false;

  for (const f of features) {
    if (!f.geometry) continue;
    const coords = flattenCoords(f.geometry);
    for (const c of coords) {
      if (c.length >= 2) {
        minX = Math.min(minX, c[0]);
        maxX = Math.max(maxX, c[0]);
        minY = Math.min(minY, c[1]);
        maxY = Math.max(maxY, c[1]);
        hasBbox = true;
      }
    }
  }

  return {
    features,
    bbox: hasBbox ? { minX, maxX, minY, maxY } : undefined,
  };
}

/**
 * Convert SHP features to internal nodes/edges model.
 * Point/MultiPoint → nodes
 * LineString/MultiLineString → edges
 * Polygon/MultiPolygon → edges (exterior ring as polyline)
 */
export function shpFeaturesToInternal(features: ShpFeature[]): {
  nodes: Array<{ id: string; x: number; y: number; z: number; tipo: string; properties: Record<string, any> }>;
  edges: Array<{
    id: string; startNodeId: string; endNodeId: string;
    dn: number; material: string; tipoRede: string;
    roughness?: number; vertices?: [number, number, number][];
    properties: Record<string, any>;
  }>;
} {
  const nodes: any[] = [];
  const edges: any[] = [];
  const nodeIndex = new Map<string, string>();
  let nodeCounter = 0;
  let edgeCounter = 0;
  const tolerance = 6;

  function getOrCreateNode(x: number, y: number, z: number): string {
    const key = `${x.toFixed(tolerance)},${y.toFixed(tolerance)}`;
    if (nodeIndex.has(key)) return nodeIndex.get(key)!;
    const id = `SHP_N${++nodeCounter}`;
    nodeIndex.set(key, id);
    nodes.push({ id, x, y, z, tipo: "junction", properties: { _source: "SHP" } });
    return id;
  }

  function addLineString(coords: number[][], props: Record<string, any>) {
    if (coords.length < 2) return;
    const first = coords[0];
    const last = coords[coords.length - 1];
    const startId = getOrCreateNode(first[0], first[1], first[2] || 0);
    const endId = getOrCreateNode(last[0], last[1], last[2] || 0);
    const vertices: [number, number, number][] = coords.map(c => [c[0], c[1], c[2] || 0]);
    edges.push({
      id: props.id || props.ID || `SHP_E${++edgeCounter}`,
      startNodeId: startId,
      endNodeId: endId,
      dn: props.diameter || props.dn || props.DIAMETRO || props.DN || 200,
      material: props.material || props.MATERIAL || "PVC",
      tipoRede: props.tipoRede || props.TIPO_REDE || props.tipo || "Genérico",
      roughness: props.roughness || props.RUGOSIDADE,
      vertices,
      properties: { ...props, _source: "SHP" },
    });
  }

  for (const feature of features) {
    if (!feature.geometry) continue;
    const props = feature.properties || {};
    const geom = feature.geometry;

    switch (geom.type) {
      case "Point": {
        const [x, y, z] = geom.coordinates;
        const id = props.id || props.ID || props.PONTO || `SHP_N${++nodeCounter}`;
        nodeIndex.set(`${x.toFixed(tolerance)},${y.toFixed(tolerance)}`, id);
        nodes.push({
          id, x, y, z: z || props.cota || props.COTA || props.Z || props.ELEVACAO || 0,
          tipo: "generic",
          properties: { ...props, _source: "SHP" },
        });
        break;
      }
      case "MultiPoint": {
        for (const coord of geom.coordinates) {
          const [x, y, z] = coord;
          const id = `SHP_N${++nodeCounter}`;
          nodeIndex.set(`${x.toFixed(tolerance)},${y.toFixed(tolerance)}`, id);
          nodes.push({
            id, x, y, z: z || props.cota || props.COTA || 0,
            tipo: "generic",
            properties: { ...props, _source: "SHP" },
          });
        }
        break;
      }
      case "LineString":
        addLineString(geom.coordinates, props);
        break;
      case "MultiLineString":
        for (const line of geom.coordinates) {
          addLineString(line, { ...props, id: undefined });
        }
        break;
      case "Polygon":
        // Polygons are area features (e.g. parcels, zones), NOT network segments.
        // Store them as point features at their centroid for reference only.
        if (geom.coordinates && geom.coordinates[0]) {
          const ring = geom.coordinates[0];
          let cx = 0, cy = 0;
          for (const c of ring) { cx += c[0]; cy += c[1]; }
          cx /= ring.length; cy /= ring.length;
          const id = props.id || props.ID || `SHP_N${++nodeCounter}`;
          nodes.push({
            id, x: cx, y: cy, z: props.cota || props.COTA || props.Z || 0,
            tipo: "generic",
            properties: { ...props, _source: "SHP", _geometryType: "Polygon" },
          });
        }
        break;
      case "MultiPolygon":
        // MultiPolygons are area features, NOT network segments.
        for (const poly of geom.coordinates) {
          if (poly[0]) {
            const ring = poly[0];
            let cx = 0, cy = 0;
            for (const c of ring) { cx += c[0]; cy += c[1]; }
            cx /= ring.length; cy /= ring.length;
            const id = `SHP_N${++nodeCounter}`;
            nodes.push({
              id, x: cx, y: cy, z: props.cota || props.COTA || props.Z || 0,
              tipo: "generic",
              properties: { ...props, _source: "SHP", _geometryType: "MultiPolygon" },
            });
          }
        }
        break;
    }
  }

  return { nodes, edges };
}

/** Flatten any GeoJSON geometry into an array of [x,y,z?] coordinate arrays */
function flattenCoords(geometry: any): number[][] {
  if (!geometry || !geometry.coordinates) return [];
  const coords: number[][] = [];

  function collect(arr: any, depth: number) {
    if (depth === 0) {
      if (Array.isArray(arr) && typeof arr[0] === "number") {
        coords.push(arr);
      }
    } else {
      for (const item of arr) {
        collect(item, depth - 1);
      }
    }
  }

  switch (geometry.type) {
    case "Point": coords.push(geometry.coordinates); break;
    case "MultiPoint": case "LineString": collect(geometry.coordinates, 0); break;
    case "MultiLineString": case "Polygon": collect(geometry.coordinates, 1); break;
    case "MultiPolygon": collect(geometry.coordinates, 2); break;
  }
  return coords;
}
