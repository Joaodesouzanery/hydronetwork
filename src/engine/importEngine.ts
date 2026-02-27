/**
 * ImportEngine — Unified import layer that converts ANY file format
 * into the internal Spatial Core model (nodes + edges + drawing_layers).
 *
 * Supported: INP, DXF, DWG, SHP, GeoJSON, CSV, TXT, XLSX, IFC, SWMM
 *
 * EPANET PRO is a CONSUMER only — it reads nodes/edges from the Spatial Core.
 * This engine NEVER modifies simulation parameters.
 */

import { PontoTopografico, parseTopographyCSV, parseTopographyXLSX } from "./reader";
import { parseDxfToPoints, extractDxfLayers, parseDxfEntities, DxfEntity } from "./dxfReader";
import { parseIFCSinglePass, ifcToInternal, analyzeIFCContent } from "./ifcReader";
import { parseSHPBuffer, shpFeaturesToInternal } from "./shpReader";
import { parseGeoTIFF, tifPointsToInternal } from "./tifReader";
import {
  SpatialNode, SpatialEdge, SpatialLayer, CRSDefinition, CRS_CATALOG,
  NodeType, LayerDiscipline, LayerGeometryType,
  createLayer, addNode, addEdge, getSpatialProject,
  detectCRSFromCoordinates, importEdgeWithAutoNodes,
  validateProject, ValidationIssue,
} from "./spatialCore";

// ════════════════════════════════════════
// LOCALE-AWARE NUMBER PARSING
// ════════════════════════════════════════

export type NumericFormat = "auto" | "br" | "us";

/**
 * Parse a localized number string to a standard float.
 * Brazilian: 1.234.567,89  →  1234567.89
 * American:  1,234,567.89  →  1234567.89
 */
export function parseLocalizedNumber(
  value: string | number | null | undefined,
  format: NumericFormat = "auto"
): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : value;

  let str = String(value).trim();
  str = str.replace(/[¤$\u20AC£¥\s\u00A0]/g, "");
  if (str === "" || str === "-") return null;

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");

  let isCommaDecimal: boolean;

  if (format === "br") {
    isCommaDecimal = true;
  } else if (format === "us") {
    isCommaDecimal = false;
  } else {
    if (lastComma > lastDot) {
      isCommaDecimal = true;
    } else if (lastDot > lastComma) {
      isCommaDecimal = false;
    } else if (lastComma >= 0 && lastDot < 0) {
      const afterComma = str.substring(lastComma + 1);
      isCommaDecimal = afterComma.length !== 3 || str.indexOf(",") === lastComma;
    } else if (lastDot >= 0 && lastComma < 0) {
      const dotCount = (str.match(/\./g) || []).length;
      if (dotCount > 1) {
        isCommaDecimal = true;
      } else {
        isCommaDecimal = false;
      }
    } else {
      isCommaDecimal = false;
    }
  }

  if (isCommaDecimal) {
    str = str.replace(/\./g, "");
    str = str.replace(",", ".");
  } else {
    str = str.replace(/,/g, "");
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Validate UTM coordinates and warn about possible numeric format issues.
 */
export function validateUTMCoordinates(x: number, y: number): { valid: boolean; warning?: string } {
  const validX = x >= 100000 && x <= 900000;
  const validY = y >= 1000000 && y <= 10000000;
  if (validX && validY) return { valid: true };
  return {
    valid: false,
    warning: `Coordenadas fora da faixa UTM esperada (X: 100000-900000, Y: 1000000-10000000). X=${x.toFixed(3)}, Y=${y.toFixed(3)}. Possível erro de interpretação de separador decimal.`
  };
}

// ════════════════════════════════════════
// TYPES
// ════════════════════════════════════════

export type ImportFileFormat =
  | "INP" | "DXF" | "DWG" | "SHP" | "GeoJSON"
  | "CSV" | "TXT" | "XLSX" | "IFC" | "SWMM" | "TIF" | "Unknown";

export type ImportModelType = "rede" | "topografia" | "bim" | "generico" | "desenho";

export type ImportMode = "geometric" | "tabular";

/**
 * FORMAT PARADIGMS — each format belongs to ONE paradigm.
 * This determines what UI to show and what parsing logic to use.
 *
 * BIM:     IFC → 3D structured model with object hierarchy. NEVER uses X/Y fields.
 * GIS:     GeoJSON, SHP, GPKG → geometry is explicit in the file. NEVER uses X/Y fields.
 * CAD:     DXF, DWG → vector drawing entities (LINE, POLYLINE, etc). NEVER uses Nó Início/Fim.
 * NETWORK: INP, SWMM → native hydraulic model with JUNCTIONS/PIPES. Self-contained.
 * TABULAR: CSV, TXT, XLSX → only paradigm that uses X/Y field mapping.
 */
export type FormatParadigm = "bim" | "gis" | "cad" | "network" | "tabular" | "raster";

export function getFormatParadigm(format: ImportFileFormat): FormatParadigm {
  switch (format) {
    case "IFC": return "bim";
    case "GeoJSON": case "SHP": return "gis";
    case "DXF": case "DWG": return "cad";
    case "INP": case "SWMM": return "network";
    case "TIF": return "raster";
    case "CSV": case "TXT": case "XLSX": default: return "tabular";
  }
}

/** Returns true if the format has explicit geometry (not tabular X/Y). */
export function isGeometryExplicitFormat(format: ImportFileFormat): boolean {
  return getFormatParadigm(format) !== "tabular";
}

/** Returns true if the format should NEVER require Nó Início / Nó Fim fields. */
export function isAutoTopologyFormat(format: ImportFileFormat): boolean {
  const p = getFormatParadigm(format);
  return p === "cad" || p === "gis" || p === "bim";
}

/** Returns true if the format should NEVER require X/Y field mapping. */
export function isGeometryIntrinsicFormat(format: ImportFileFormat): boolean {
  const p = getFormatParadigm(format);
  return p !== "tabular";
}

export type EntityImportRole = "edge" | "node" | "drawing" | "ignore";

export interface EntityTypeMapping {
  entityType: string;
  role: EntityImportRole;
  count: number;
}

export interface ImportedRecord {
  [key: string]: any;
}

export interface ImportEngineResult {
  nodes: SpatialNode[];
  edges: SpatialEdge[];
  drawingLayers: SpatialLayer[];
  networkLayers: SpatialLayer[];
  validationIssues: ValidationIssue[];
  patterns?: InpPattern[];
  curves?: InpCurve[];
  options?: InpOptions;
  times?: InpTimes;
  stats: {
    nodesCreated: number;
    edgesCreated: number;
    drawingLayersCreated: number;
    networkLayersCreated: number;
    patternsCount?: number;
    curvesCount?: number;
  };
}

export interface FieldMapping {
  id?: string;
  x?: string;
  y?: string;
  z?: string;
  cotaFundo?: string;
  profundidade?: string;
  noInicio?: string;
  noFim?: string;
  diametro?: string;
  material?: string;
  comprimento?: string;
  declividade?: string;
  rugosidade?: string;
  demanda?: string;
  tipo?: string;
  nome?: string;
  layer?: string;
}

export interface ImportOptions {
  crs: CRSDefinition;
  modelType: ImportModelType;
  discipline: LayerDiscipline;
  layerName: string;
  sourceFile: string;
  fieldMapping: FieldMapping;
  isDrawingOnly: boolean;
  numericFormat?: NumericFormat;
  importMode?: ImportMode;
  entityMappings?: EntityTypeMapping[];
  snapTolerance?: number;
}

// ════════════════════════════════════════
// RAW FILE ANALYSIS (Geometry-First)
// Counts geometry DIRECTLY from the file
// WITHOUT depending on entity mappings
// ════════════════════════════════════════

export interface RawFileAnalysis {
  /** Total count per geometry/entity type */
  entityCounts: { type: string; count: number; geometricClass: "point" | "line" | "polygon" | "solid" | "other" }[];
  /** Total raw geometries found */
  totalGeometries: number;
  /** Bounding box from raw coords */
  bbox: { minX: number; maxX: number; minY: number; maxY: number } | null;
  /** Any coord samples for format detection */
  coordSamples: { x: number; y: number; z?: number }[];
  /** Detected layers/classes */
  layers: string[];
  /** Format-specific info */
  formatInfo: Record<string, any>;
}

/** Classify a geometry/entity type into a geometric class */
function classifyGeometryType(type: string): "point" | "line" | "polygon" | "solid" | "other" {
  const t = type.toUpperCase();
  // Point types
  if (t === "POINT" || t === "INSERT" || t === "MULTIPOINT" || t === "TEXT" || t === "MTEXT" ||
    t.includes("POINT") || t.includes("TERMINAL") || t.includes("FITTING")) return "point";
  // Line types
  if (t === "LINE" || t === "LWPOLYLINE" || t === "POLYLINE" || t === "3DPOLYLINE" ||
    t === "LINESTRING" || t === "MULTILINESTRING" || t === "ARC" || t === "SPLINE" || t === "ELLIPSE" ||
    t.includes("PIPE") || t.includes("DUCT") || t.includes("CONDUIT") || t.includes("SEGMENT")) return "line";
  // Polygon types
  if (t === "POLYGON" || t === "MULTIPOLYGON" || t === "CIRCLE" || t === "3DFACE" ||
    t.includes("SLAB") || t.includes("WALL")) return "polygon";
  // Solid types
  if (t.includes("SOLID") || t.includes("BEAM") || t.includes("COLUMN")) return "solid";
  return "other";
}

/**
 * Analyze a file's raw geometry WITHOUT any conversion or entity mapping.
 * This MUST return counts > 0 if the file contains any geometry.
 */
export function analyzeFileRaw(content: string, format: ImportFileFormat): RawFileAnalysis {
  const result: RawFileAnalysis = {
    entityCounts: [],
    totalGeometries: 0,
    bbox: null,
    coordSamples: [],
    layers: [],
    formatInfo: {},
  };

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let hasBbox = false;

  function updateBbox(x: number, y: number) {
    if (isNaN(x) || isNaN(y)) return;
    hasBbox = true;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  switch (format) {
    case "DXF": {
      const entities = parseDxfEntities(content);
      const counts = new Map<string, number>();
      const layerSet = new Set<string>();
      for (const e of entities) {
        counts.set(e.type, (counts.get(e.type) || 0) + 1);
        if (e.layer) layerSet.add(e.layer);
        if (e.x !== undefined && e.y !== undefined) {
          updateBbox(e.x, e.y);
          if (result.coordSamples.length < 10) result.coordSamples.push({ x: e.x, y: e.y, z: e.z });
        }
        if (e.x2 !== undefined && e.y2 !== undefined) updateBbox(e.x2, e.y2);
        if (e.vertices) {
          for (const v of e.vertices) {
            updateBbox(v.x, v.y);
            if (result.coordSamples.length < 10) result.coordSamples.push({ x: v.x, y: v.y, z: v.z });
          }
        }
      }
      result.entityCounts = Array.from(counts.entries()).map(([type, count]) => ({
        type, count, geometricClass: classifyGeometryType(type),
      }));
      result.layers = Array.from(layerSet).sort();
      result.formatInfo = { entityCount: entities.length };
      break;
    }
    case "GeoJSON": {
      const geojson = JSON.parse(content);
      const features = geojson.type === "FeatureCollection" ? geojson.features
        : geojson.type === "Feature" ? [geojson]
        : geojson.type ? [{ type: "Feature", geometry: geojson, properties: {} }] : [];
      const counts = new Map<string, number>();
      
      function processGeometry(geom: any) {
        if (!geom || !geom.type) return;
        const gtype = geom.type;
        
        if (gtype === "GeometryCollection") {
          for (const g of (geom.geometries || [])) processGeometry(g);
          return;
        }

        counts.set(gtype, (counts.get(gtype) || 0) + 1);

        // Extract coords for bbox
        if (gtype === "Point" && geom.coordinates) {
          const [x, y, z] = geom.coordinates;
          updateBbox(x, y);
          if (result.coordSamples.length < 10) result.coordSamples.push({ x, y, z });
        } else if (gtype === "MultiPoint" && geom.coordinates) {
          for (const c of geom.coordinates) { updateBbox(c[0], c[1]); }
        } else if (gtype === "LineString" && geom.coordinates) {
          for (const c of geom.coordinates) { updateBbox(c[0], c[1]); }
          if (result.coordSamples.length < 10 && geom.coordinates.length > 0) {
            const c = geom.coordinates[0];
            result.coordSamples.push({ x: c[0], y: c[1], z: c[2] });
          }
        } else if (gtype === "MultiLineString" && geom.coordinates) {
          for (const line of geom.coordinates) { for (const c of line) { updateBbox(c[0], c[1]); } }
        } else if (gtype === "Polygon" && geom.coordinates) {
          for (const ring of geom.coordinates) { for (const c of ring) { updateBbox(c[0], c[1]); } }
        } else if (gtype === "MultiPolygon" && geom.coordinates) {
          for (const poly of geom.coordinates) { for (const ring of poly) { for (const c of ring) { updateBbox(c[0], c[1]); } } }
        }
      }

      for (const feature of features) {
        processGeometry(feature.geometry || feature);
      }

      result.entityCounts = Array.from(counts.entries()).map(([type, count]) => ({
        type, count, geometricClass: classifyGeometryType(type),
      }));
      result.formatInfo = { featureCount: features.length };
      break;
    }
    case "INP": {
      const lines = content.split(/\r?\n/);
      let section = "";
      const counts = new Map<string, number>();
      const patternIds = new Set<string>();
      const curveIds = new Set<string>();
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith("[")) {
          section = line.toUpperCase().replace(/\s/g, "");
          continue;
        }
        if (!line || line.startsWith(";")) continue;
        const dataLine = line.split(";")[0].trim();
        if (!dataLine) continue;
        const p = dataLine.split(/[\s\t]+/).filter(Boolean);

        if (section === "[JUNCTIONS]") counts.set("JUNCTION", (counts.get("JUNCTION") || 0) + 1);
        else if (section === "[PIPES]") counts.set("PIPE", (counts.get("PIPE") || 0) + 1);
        else if (section === "[RESERVOIRS]") counts.set("RESERVOIR", (counts.get("RESERVOIR") || 0) + 1);
        else if (section === "[TANKS]") counts.set("TANK", (counts.get("TANK") || 0) + 1);
        else if (section === "[PUMPS]") counts.set("PUMP", (counts.get("PUMP") || 0) + 1);
        else if (section === "[VALVES]") counts.set("VALVE", (counts.get("VALVE") || 0) + 1);
        else if (section === "[VERTICES]") counts.set("VERTEX", (counts.get("VERTEX") || 0) + 1);
        else if (section === "[EMITTERS]") counts.set("EMITTER", (counts.get("EMITTER") || 0) + 1);
        else if (section === "[PATTERNS]" && p.length >= 1) patternIds.add(p[0]);
        else if (section === "[CURVES]" && p.length >= 1) curveIds.add(p[0]);
        else if (section === "[COORDINATES]") {
          if (p.length >= 3) {
            const x = parseFloat(p[1]);
            const y = parseFloat(p[2]);
            updateBbox(x, y);
            if (result.coordSamples.length < 10) result.coordSamples.push({ x, y });
          }
        }
      }
      if (patternIds.size > 0) counts.set("PATTERN", patternIds.size);
      if (curveIds.size > 0) counts.set("CURVE", curveIds.size);
      result.entityCounts = Array.from(counts.entries()).map(([type, count]) => ({
        type, count, geometricClass: classifyGeometryType(type),
      }));
      break;
    }
    case "SWMM": {
      const lines = content.split(/\r?\n/);
      let section = "";
      const counts = new Map<string, number>();
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith("[")) { section = line.toUpperCase().replace(/\s/g, ""); continue; }
        if (!line || line.startsWith(";")) continue;
        const dataLine = line.split(";")[0].trim();
        if (!dataLine) continue;

        if (section === "[JUNCTIONS]") counts.set("JUNCTION", (counts.get("JUNCTION") || 0) + 1);
        else if (section === "[CONDUITS]") counts.set("CONDUIT", (counts.get("CONDUIT") || 0) + 1);
        else if (section === "[OUTFALLS]") counts.set("OUTFALL", (counts.get("OUTFALL") || 0) + 1);
        else if (section === "[COORDINATES]") {
          const p = dataLine.split(/[\s\t]+/).filter(Boolean);
          if (p.length >= 3) {
            const x = parseFloat(p[1]);
            const y = parseFloat(p[2]);
            updateBbox(x, y);
          }
        }
      }
      result.entityCounts = Array.from(counts.entries()).map(([type, count]) => ({
        type, count, geometricClass: classifyGeometryType(type),
      }));
      break;
    }
    case "IFC": {
      // Use improved single-pass IFC parser
      const ifcAnalysis = analyzeIFCContent(content);
      result.entityCounts = ifcAnalysis.entityCounts.map(e => ({
        type: e.type, count: e.count, geometricClass: classifyGeometryType(e.type),
      }));
      if (ifcAnalysis.bbox) {
        updateBbox(ifcAnalysis.bbox.minX, ifcAnalysis.bbox.minY);
        updateBbox(ifcAnalysis.bbox.maxX, ifcAnalysis.bbox.maxY);
      }
      for (const s of ifcAnalysis.coordSamples) {
        if (result.coordSamples.length < 10) result.coordSamples.push(s);
      }
      break;
    }
    default: {
      // CSV/TXT/XLSX — count rows as generic records
      const lines = content.split(/\r?\n/).filter(l => l.trim());
      if (lines.length > 1) {
        result.entityCounts = [{ type: "ROW", count: lines.length - 1, geometricClass: "other" as const }];
      }
      break;
    }
  }

  result.totalGeometries = result.entityCounts.reduce((sum, e) => sum + e.count, 0);
  if (hasBbox) {
    result.bbox = { minX, maxX, minY, maxY };
  }

  return result;
}

// ════════════════════════════════════════
// FILE FORMAT DETECTION
// ════════════════════════════════════════

export function detectFileFormat(fileName: string, content?: string): ImportFileFormat {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "inp": return "INP";
    case "dxf": return "DXF";
    case "dwg": return "DWG";
    case "shp": return "SHP";
    case "geojson": case "json": {
      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (parsed.type === "FeatureCollection" || parsed.type === "Feature") return "GeoJSON";
        } catch { /* not json */ }
      }
      return ext === "geojson" ? "GeoJSON" : "Unknown";
    }
    case "csv": return "CSV";
    case "txt": return "TXT";
    case "xlsx": case "xls": return "XLSX";
    case "ifc": return "IFC";
    case "tif": case "tiff": return "TIF";
    default: {
      if (content && content.includes("[SUBCATCHMENTS]")) return "SWMM";
      return "Unknown";
    }
  }
}

// ════════════════════════════════════════
// INP PARSER (EPANET format → internal model)
// Does NOT alter hydraulic parameters.
// ════════════════════════════════════════

export interface InpPattern {
  id: string;
  multipliers: number[];
}

export interface InpCurve {
  id: string;
  type: "PUMP" | "EFFICIENCY" | "VOLUME" | "HEADLOSS" | "GENERAL";
  points: { x: number; y: number }[];
}

export interface InpOptions {
  units?: string;
  headloss?: string;
  quality?: string;
  viscosity?: number;
  diffusivity?: number;
  specificGravity?: number;
  trials?: number;
  accuracy?: number;
  unbalanced?: string;
  pattern?: string;
  demandMultiplier?: number;
  emitterExponent?: number;
  [key: string]: any;
}

export interface InpTimes {
  duration?: string;
  hydraulicTimestep?: string;
  qualityTimestep?: string;
  reportTimestep?: string;
  reportStart?: string;
  patternTimestep?: string;
  patternStart?: string;
  ruleTimestep?: string;
  startClocktime?: string;
  statistic?: string;
  [key: string]: any;
}

export interface InpParsed {
  nodes: Array<{ id: string; x: number; y: number; z: number; tipo: NodeType; demanda?: number; properties: Record<string, any> }>;
  edges: Array<{
    id: string; startNodeId: string; endNodeId: string; dn: number;
    material: string; tipoRede: string; roughness?: number;
    vertices?: [number, number, number][];
    properties: Record<string, any>;
  }>;
  patterns?: InpPattern[];
  curves?: InpCurve[];
  options?: InpOptions;
  times?: InpTimes;
}

export function parseINPToInternal(content: string): InpParsed {
  const lines = content.split(/\r?\n/);
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];
  const patterns: InpPattern[] = [];
  const curves: InpCurve[] = [];
  const options: InpOptions = {};
  const times: InpTimes = {};
  const coordMap = new Map<string, { x: number; y: number }>();
  const verticesMap = new Map<string, [number, number, number][]>();
  const emitterMap = new Map<string, number>();
  const statusMap = new Map<string, string>();
  const qualityMap = new Map<string, number>();
  const patternMap = new Map<string, number[]>();
  const curveMap = new Map<string, { x: number; y: number }[]>();
  const curveTypeMap = new Map<string, InpCurve["type"]>();
  let section = "";

  // ── Pass 1: Collect coordinates, vertices, and lookup data ──
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("[")) { section = line.toUpperCase().replace(/\s/g, ""); continue; }
    if (!line || line.startsWith(";")) continue;
    const dataLine = line.split(";")[0].trim();
    if (!dataLine) continue;
    const p = dataLine.split(/[\s\t]+/).filter(Boolean);

    if (section === "[COORDINATES]" && p.length >= 3) {
      coordMap.set(p[0], { x: +p[1], y: +p[2] });
    } else if (section === "[VERTICES]" && p.length >= 3) {
      const linkId = p[0];
      if (!verticesMap.has(linkId)) verticesMap.set(linkId, []);
      verticesMap.get(linkId)!.push([+p[1], +p[2], 0]);
    } else if (section === "[EMITTERS]" && p.length >= 2) {
      emitterMap.set(p[0], +p[1]);
    } else if (section === "[STATUS]" && p.length >= 2) {
      statusMap.set(p[0], p[1].toUpperCase());
    } else if (section === "[QUALITY]" && p.length >= 2) {
      qualityMap.set(p[0], +p[1]);
    } else if (section === "[PATTERNS]" && p.length >= 2) {
      const patId = p[0];
      const multipliers = p.slice(1).map(v => +v);
      if (!patternMap.has(patId)) patternMap.set(patId, []);
      patternMap.get(patId)!.push(...multipliers);
    } else if (section === "[CURVES]" && p.length >= 3) {
      const curveId = p[0];
      if (!curveMap.has(curveId)) curveMap.set(curveId, []);
      curveMap.get(curveId)!.push({ x: +p[1], y: +p[2] });
    } else if (section === "[OPTIONS]" && p.length >= 2) {
      const key = p[0].toLowerCase();
      const val = p.slice(1).join(" ");
      switch (key) {
        case "units": options.units = val; break;
        case "headloss": options.headloss = val; break;
        case "quality": options.quality = val; break;
        case "viscosity": options.viscosity = +p[1]; break;
        case "diffusivity": options.diffusivity = +p[1]; break;
        case "specific": if (p[1]?.toLowerCase() === "gravity") options.specificGravity = +p[2]; break;
        case "trials": options.trials = +p[1]; break;
        case "accuracy": options.accuracy = +p[1]; break;
        case "unbalanced": options.unbalanced = val; break;
        case "pattern": options.pattern = p[1]; break;
        case "demand": if (p[1]?.toLowerCase() === "multiplier") options.demandMultiplier = +p[2]; break;
        case "emitter": if (p[1]?.toLowerCase() === "exponent") options.emitterExponent = +p[2]; break;
        default: options[key] = val; break;
      }
    } else if (section === "[TIMES]" && p.length >= 2) {
      const key = p[0].toLowerCase();
      const val = p.slice(1).join(" ");
      switch (key) {
        case "duration": times.duration = val; break;
        case "hydraulic": if (p[1]?.toLowerCase() === "timestep") times.hydraulicTimestep = p.slice(2).join(" "); break;
        case "quality": if (p[1]?.toLowerCase() === "timestep") times.qualityTimestep = p.slice(2).join(" "); break;
        case "report": {
          const sub = p[1]?.toLowerCase();
          if (sub === "timestep") times.reportTimestep = p.slice(2).join(" ");
          else if (sub === "start") times.reportStart = p.slice(2).join(" ");
          break;
        }
        case "pattern": {
          const sub = p[1]?.toLowerCase();
          if (sub === "timestep") times.patternTimestep = p.slice(2).join(" ");
          else if (sub === "start") times.patternStart = p.slice(2).join(" ");
          break;
        }
        case "rule": if (p[1]?.toLowerCase() === "timestep") times.ruleTimestep = p.slice(2).join(" "); break;
        case "start": if (p[1]?.toLowerCase() === "clocktime") times.startClocktime = p.slice(2).join(" "); break;
        case "statistic": times.statistic = val; break;
        default: times[key] = val; break;
      }
    }
  }

  // ── Detect curve types from comments (EPANET convention: ;TYPE line before data) ──
  section = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("[")) { section = line.toUpperCase().replace(/\s/g, ""); continue; }
    if (section !== "[CURVES]") continue;
    if (line.startsWith(";") && i + 1 < lines.length) {
      const comment = line.substring(1).trim().toUpperCase();
      const nextLine = lines[i + 1].trim().split(";")[0].trim();
      if (nextLine) {
        const nextP = nextLine.split(/[\s\t]+/).filter(Boolean);
        if (nextP.length >= 3) {
          const curveId = nextP[0];
          if (comment.includes("PUMP")) curveTypeMap.set(curveId, "PUMP");
          else if (comment.includes("EFFICIENCY")) curveTypeMap.set(curveId, "EFFICIENCY");
          else if (comment.includes("VOLUME")) curveTypeMap.set(curveId, "VOLUME");
          else if (comment.includes("HEADLOSS")) curveTypeMap.set(curveId, "HEADLOSS");
        }
      }
    }
  }

  // ── Build patterns array ──
  for (const [id, multipliers] of patternMap) {
    patterns.push({ id, multipliers });
  }

  // ── Build curves array ──
  for (const [id, points] of curveMap) {
    curves.push({ id, type: curveTypeMap.get(id) || "GENERAL", points });
  }

  // ── Pass 2: Build nodes and edges ──
  section = "";
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("[")) { section = line.toUpperCase().replace(/\s/g, ""); continue; }
    if (!line || line.startsWith(";")) continue;
    const dataLine = line.split(";")[0].trim();
    if (!dataLine) continue;
    const p = dataLine.split(/[\s\t]+/).filter(Boolean);

    switch (section) {
      case "[JUNCTIONS]":
        if (p.length >= 2) {
          const coord = coordMap.get(p[0]) || { x: 0, y: 0 };
          const emitter = emitterMap.get(p[0]);
          const quality = qualityMap.get(p[0]);
          nodes.push({
            id: p[0], x: coord.x, y: coord.y, z: +p[1],
            tipo: "junction", demanda: p.length >= 3 ? +p[2] : undefined,
            properties: {
              elevation: +p[1], demand: p.length >= 3 ? +p[2] : 0, pattern: p[3] || "",
              ...(emitter !== undefined && { emitter }),
              ...(quality !== undefined && { quality }),
              _source: "INP",
            },
          });
        }
        break;
      case "[RESERVOIRS]":
        if (p.length >= 2) {
          const coord = coordMap.get(p[0]) || { x: 0, y: 0 };
          const quality = qualityMap.get(p[0]);
          nodes.push({
            id: p[0], x: coord.x, y: coord.y, z: +p[1],
            tipo: "reservoir",
            properties: {
              head: +p[1], pattern: p[2] || "",
              ...(quality !== undefined && { quality }),
              _source: "INP",
            },
          });
        }
        break;
      case "[TANKS]":
        if (p.length >= 6) {
          const coord = coordMap.get(p[0]) || { x: 0, y: 0 };
          const quality = qualityMap.get(p[0]);
          nodes.push({
            id: p[0], x: coord.x, y: coord.y, z: +p[1],
            tipo: "reservoir",
            properties: {
              elevation: +p[1], initLevel: +p[2], minLevel: +p[3], maxLevel: +p[4], diameter: +p[5],
              ...(quality !== undefined && { quality }),
              _source: "INP", _type: "tank",
            },
          });
        }
        break;
      case "[PIPES]":
        if (p.length >= 6) {
          const linkVertices = verticesMap.get(p[0]);
          const linkStatus = statusMap.get(p[0]);
          edges.push({
            id: p[0], startNodeId: p[1], endNodeId: p[2],
            dn: +p[4], material: p.length >= 8 ? p[7] : "PVC",
            tipoRede: "Rede de Água", roughness: +p[5],
            ...(linkVertices && { vertices: linkVertices }),
            properties: {
              length: +p[3], diameter: +p[4], roughness: +p[5],
              ...(linkStatus && { status: linkStatus }),
              ...(p[6] && { minorLoss: +p[6] }),
              _source: "INP",
            },
          });
        }
        break;
      case "[PUMPS]":
        if (p.length >= 3) {
          const powerIdx = p.findIndex(v => v.toUpperCase() === "POWER");
          const headIdx = p.findIndex(v => v.toUpperCase() === "HEAD");
          const speedIdx = p.findIndex(v => v.toUpperCase() === "SPEED");
          const patIdx = p.findIndex(v => v.toUpperCase() === "PATTERN");
          const power = powerIdx >= 0 && p[powerIdx + 1] ? +p[powerIdx + 1] : (+p[3] || 10);
          const linkVertices = verticesMap.get(p[0]);
          const linkStatus = statusMap.get(p[0]);
          edges.push({
            id: p[0], startNodeId: p[1], endNodeId: p[2],
            dn: 0, material: "Bomba", tipoRede: "Recalque",
            ...(linkVertices && { vertices: linkVertices }),
            properties: {
              power,
              ...(headIdx >= 0 && p[headIdx + 1] && { headCurve: p[headIdx + 1] }),
              ...(speedIdx >= 0 && p[speedIdx + 1] && { speed: +p[speedIdx + 1] }),
              ...(patIdx >= 0 && p[patIdx + 1] && { pattern: p[patIdx + 1] }),
              ...(linkStatus && { status: linkStatus }),
              _source: "INP", _type: "pump",
            },
          });
        }
        break;
      case "[VALVES]":
        if (p.length >= 6) {
          const linkVertices = verticesMap.get(p[0]);
          const linkStatus = statusMap.get(p[0]);
          edges.push({
            id: p[0], startNodeId: p[1], endNodeId: p[2],
            dn: +p[3], material: "Válvula", tipoRede: "Rede de Água",
            ...(linkVertices && { vertices: linkVertices }),
            properties: {
              valveType: p[4], setting: +p[5],
              ...(p[6] && { minorLoss: +p[6] }),
              ...(linkStatus && { status: linkStatus }),
              _source: "INP", _type: "valve",
            },
          });
        }
        break;
    }
  }

  return { nodes, edges, patterns, curves, options, times };
}

// ════════════════════════════════════════
// SWMM PARSER → internal model
// ════════════════════════════════════════

export function parseSWMMToInternal(content: string): InpParsed {
  const lines = content.split(/\r?\n/);
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];
  const coordMap = new Map<string, { x: number; y: number }>();
  let section = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("[")) { section = line.toUpperCase().replace(/\s/g, ""); continue; }
    if (!line || line.startsWith(";")) continue;
    const p = line.split(/[\s\t]+/).filter(Boolean);
    if (section === "[COORDINATES]" && p.length >= 3) {
      coordMap.set(p[0], { x: +p[1], y: +p[2] });
    }
  }

  section = "";
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("[")) { section = line.toUpperCase().replace(/\s/g, ""); continue; }
    if (!line || line.startsWith(";")) continue;
    const p = line.split(/[\s\t]+/).filter(Boolean);

    switch (section) {
      case "[JUNCTIONS]":
        if (p.length >= 2) {
          const coord = coordMap.get(p[0]) || { x: 0, y: 0 };
          nodes.push({
            id: p[0], x: coord.x, y: coord.y, z: +p[1],
            tipo: "pv",
            properties: { elevation: +p[1], maxDepth: p.length >= 3 ? +p[2] : 0, _source: "SWMM" },
          });
        }
        break;
      case "[OUTFALLS]":
        if (p.length >= 2) {
          const coord = coordMap.get(p[0]) || { x: 0, y: 0 };
          nodes.push({
            id: p[0], x: coord.x, y: coord.y, z: +p[1],
            tipo: "outfall",
            properties: { elevation: +p[1], _source: "SWMM" },
          });
        }
        break;
      case "[CONDUITS]":
        if (p.length >= 4) {
          edges.push({
            id: p[0], startNodeId: p[1], endNodeId: p[2],
            dn: 0, material: "Concreto", tipoRede: "Esgoto por Gravidade",
            properties: { length: +p[3], roughness: p.length >= 5 ? +p[4] : 0.013, _source: "SWMM" },
          });
        }
        break;
    }
  }

  return { nodes, edges };
}

// ════════════════════════════════════════
// GEOJSON PARSER → internal model (GEOMETRIC MODE)
// Supports: Point, MultiPoint, LineString, MultiLineString,
//           Polygon, MultiPolygon, GeometryCollection
// ════════════════════════════════════════

export function parseGeoJSONToInternal(content: string, numericFormat: NumericFormat = "auto"): InpParsed {
  const geojson = JSON.parse(content);
  const features = geojson.type === "FeatureCollection" ? geojson.features
    : geojson.type === "Feature" ? [geojson]
    : geojson.type ? [{ type: "Feature", geometry: geojson, properties: {} }] : [];
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];
  const nodeIndex = new Map<string, string>();
  let nodeCounter = 0;
  let edgeCounter = 0;
  const tolerance = 6;

  function getOrCreateNode(x: number, y: number, z: number): string {
    const key = `${x.toFixed(tolerance)},${y.toFixed(tolerance)}`;
    if (nodeIndex.has(key)) return nodeIndex.get(key)!;
    const id = `GJ_N${++nodeCounter}`;
    nodeIndex.set(key, id);
    nodes.push({ id, x, y, z, tipo: "junction", properties: { _source: "GeoJSON" } });
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
      id: props.id || `GJ_E${++edgeCounter}`,
      startNodeId: startId, endNodeId: endId,
      dn: props.diameter || props.dn || 200,
      material: props.material || "PVC",
      tipoRede: props.tipoRede || "Genérico",
      roughness: props.roughness,
      vertices,
      properties: { ...props, _source: "GeoJSON" },
    });
  }

  function processGeometry(geom: any, props: Record<string, any>) {
    if (!geom || !geom.type) return;

    switch (geom.type) {
      case "Point": {
        const [x, y, z] = geom.coordinates;
        const id = props.id || props.ID || `GJ_N${++nodeCounter}`;
        nodeIndex.set(`${x.toFixed(tolerance)},${y.toFixed(tolerance)}`, id);
        nodes.push({ id, x, y, z: z || 0, tipo: "generic", properties: { ...props, _source: "GeoJSON" } });
        break;
      }
      case "MultiPoint": {
        for (const coord of geom.coordinates) {
          const [x, y, z] = coord;
          const id = `GJ_N${++nodeCounter}`;
          nodeIndex.set(`${x.toFixed(tolerance)},${y.toFixed(tolerance)}`, id);
          nodes.push({ id, x, y, z: z || 0, tipo: "generic", properties: { ...props, _source: "GeoJSON" } });
        }
        break;
      }
      case "LineString": {
        addLineString(geom.coordinates, props);
        break;
      }
      case "MultiLineString": {
        for (const line of geom.coordinates) {
          addLineString(line, { ...props, id: undefined }); // each sub-line gets unique id
        }
        break;
      }
      case "Polygon": {
        // Import exterior ring as a closed polyline edge
        if (geom.coordinates && geom.coordinates[0]) {
          addLineString(geom.coordinates[0], { ...props, id: undefined, _geometryType: "Polygon" });
        }
        break;
      }
      case "MultiPolygon": {
        for (const poly of geom.coordinates) {
          if (poly[0]) {
            addLineString(poly[0], { ...props, id: undefined, _geometryType: "MultiPolygon" });
          }
        }
        break;
      }
      case "GeometryCollection": {
        for (const g of (geom.geometries || [])) {
          processGeometry(g, props);
        }
        break;
      }
    }
  }

  for (const feature of features) {
    const props = feature.properties || {};
    processGeometry(feature.geometry || feature, props);
  }

  return { nodes, edges };
}

// ════════════════════════════════════════
// DXF → internal model (GEOMETRIC MODE)
// Lines/Polylines → edges with auto-generated nodes
// Points/Inserts → nodes
// ════════════════════════════════════════

export function parseDXFToInternal(
  content: string,
  entityMappings?: EntityTypeMapping[],
  numericFormat: NumericFormat = "auto"
): InpParsed {
  const entities = parseDxfEntities(content);
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];
  const nodeIndex = new Map<string, string>();
  let nodeCounter = 0;
  let edgeCounter = 0;
  const snapDecimals = 4;

  // Build role lookup from entity mappings
  const roleMap = new Map<string, EntityImportRole>();
  if (entityMappings && entityMappings.length > 0) {
    entityMappings.forEach(m => roleMap.set(m.entityType.toUpperCase(), m.role));
  } else {
    // Default: lines→edge, points→node
    roleMap.set("LINE", "edge");
    roleMap.set("LWPOLYLINE", "edge");
    roleMap.set("POLYLINE", "edge");
    roleMap.set("3DPOLYLINE", "edge");
    roleMap.set("POINT", "node");
    roleMap.set("INSERT", "node");
    roleMap.set("CIRCLE", "ignore");
  }

  function getOrCreateNode(x: number, y: number, z: number, layer?: string): string {
    const key = `${x.toFixed(snapDecimals)},${y.toFixed(snapDecimals)}`;
    if (nodeIndex.has(key)) return nodeIndex.get(key)!;
    const id = `DXF_N${++nodeCounter}`;
    nodeIndex.set(key, id);
    nodes.push({ id, x, y, z, tipo: "junction", properties: { layer, _source: "DXF" } });
    return id;
  }

  for (const e of entities) {
    const role = roleMap.get(e.type.toUpperCase()) ?? "ignore";
    if (role === "ignore" || role === "drawing") continue;

    if (role === "node") {
      if (e.x !== undefined && e.y !== undefined) {
        const id = getOrCreateNode(e.x, e.y, e.z ?? 0, e.layer);
        const existing = nodes.find(n => n.id === id);
        if (existing && e.type === "INSERT") {
          existing.tipo = "pv";
          existing.properties.entityType = e.type;
          existing.properties.layer = e.layer;
        }
      }
    } else if (role === "edge") {
      if (e.type === "LINE") {
        if (e.x !== undefined && e.y !== undefined && e.x2 !== undefined && e.y2 !== undefined) {
          const startId = getOrCreateNode(e.x, e.y, e.z ?? 0, e.layer);
          const endId = getOrCreateNode(e.x2, e.y2, e.z2 ?? 0, e.layer);
          edges.push({
            id: `DXF_E${++edgeCounter}`,
            startNodeId: startId, endNodeId: endId,
            dn: 200, material: "PVC", tipoRede: "Genérico",
            vertices: [[e.x, e.y, e.z ?? 0], [e.x2, e.y2, e.z2 ?? 0]],
            properties: { layer: e.layer, entityType: e.type, _source: "DXF" },
          });
        }
      } else if (e.type === "LWPOLYLINE" || e.type === "POLYLINE" || e.type === "3DPOLYLINE") {
        const verts: { x: number; y: number; z: number }[] = [];
        if (e.vertices && e.vertices.length > 0) {
          verts.push(...e.vertices);
        }
        // For LWPOLYLINE, the first point may be in x,y,z fields
        if (e.x !== undefined && e.y !== undefined) {
          // Check if this point is already the first vertex
          const firstVert = verts[0];
          if (!firstVert || (Math.abs(firstVert.x - e.x) > 0.0001 || Math.abs(firstVert.y - e.y) > 0.0001)) {
            verts.unshift({ x: e.x, y: e.y, z: e.z ?? 0 });
          }
        }
        if (verts.length >= 2) {
          const first = verts[0];
          const last = verts[verts.length - 1];
          const startId = getOrCreateNode(first.x, first.y, first.z, e.layer);
          const endId = getOrCreateNode(last.x, last.y, last.z, e.layer);
          edges.push({
            id: `DXF_E${++edgeCounter}`,
            startNodeId: startId, endNodeId: endId,
            dn: 200, material: "PVC", tipoRede: "Genérico",
            vertices: verts.map(v => [v.x, v.y, v.z] as [number, number, number]),
            properties: { layer: e.layer, entityType: e.type, _source: "DXF" },
          });
        } else if (verts.length === 1) {
          // Single vertex polyline → treat as point
          getOrCreateNode(verts[0].x, verts[0].y, verts[0].z, e.layer);
        }
      }
    }
  }

  return { nodes, edges };
}

// ════════════════════════════════════════
// DXF ENTITY TYPE DETECTION
// Returns counts of each entity type for UI selection
// ════════════════════════════════════════

export function detectDxfEntityTypes(content: string): EntityTypeMapping[] {
  const entities = parseDxfEntities(content);
  const counts = new Map<string, number>();
  for (const e of entities) {
    counts.set(e.type, (counts.get(e.type) || 0) + 1);
  }

  const lineTypes = new Set(["LINE", "LWPOLYLINE", "POLYLINE", "3DPOLYLINE"]);
  const pointTypes = new Set(["POINT", "INSERT"]);

  return Array.from(counts.entries()).map(([entityType, count]) => ({
    entityType,
    role: lineTypes.has(entityType) ? "edge" as EntityImportRole
      : pointTypes.has(entityType) ? "node" as EntityImportRole
      : "ignore" as EntityImportRole,
    count,
  }));
}

// ════════════════════════════════════════
// DETECT GEOJSON ENTITY TYPES
// ════════════════════════════════════════

export function detectGeoJSONEntityTypes(content: string): EntityTypeMapping[] {
  const geojson = JSON.parse(content);
  const features = geojson.type === "FeatureCollection" ? geojson.features
    : geojson.type === "Feature" ? [geojson]
    : geojson.type ? [{ type: "Feature", geometry: geojson, properties: {} }] : [];
  const counts = new Map<string, number>();

  function countGeom(geom: any) {
    if (!geom || !geom.type) return;
    if (geom.type === "GeometryCollection") {
      for (const g of (geom.geometries || [])) countGeom(g);
      return;
    }
    counts.set(geom.type, (counts.get(geom.type) || 0) + 1);
  }

  for (const f of features) countGeom(f.geometry || f);

  const lineTypes = new Set(["LineString", "MultiLineString"]);
  const pointTypes = new Set(["Point", "MultiPoint"]);

  return Array.from(counts.entries()).map(([entityType, count]) => ({
    entityType,
    role: lineTypes.has(entityType) ? "edge" as EntityImportRole
      : pointTypes.has(entityType) ? "node" as EntityImportRole
      : "ignore" as EntityImportRole,
    count,
  }));
}

// ════════════════════════════════════════
// DETECT INP/SWMM ENTITY TYPES
// ════════════════════════════════════════

export function detectINPEntityTypes(content: string): EntityTypeMapping[] {
  const analysis = analyzeFileRaw(content, "INP");
  return analysis.entityCounts.map(e => ({
    entityType: e.type,
    role: e.geometricClass === "line" ? "edge" as EntityImportRole
      : e.geometricClass === "point" ? "node" as EntityImportRole
      : "ignore" as EntityImportRole,
    count: e.count,
  }));
}

// ════════════════════════════════════════
// GENERIC TABULAR (CSV/TXT/XLSX) → internal model
// Uses field mapping from user + locale-aware parsing
// ════════════════════════════════════════

export function parseTabularToInternal(
  rows: Record<string, any>[],
  mapping: FieldMapping,
  numericFormat: NumericFormat = "auto"
): InpParsed {
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];
  const isEdgeMode = !!mapping.noInicio && !!mapping.noFim;

  const pn = (val: any) => parseLocalizedNumber(val, numericFormat);

  if (isEdgeMode) {
    const nodeMap = new Map<string, { x: number; y: number; z: number }>();
    rows.forEach((row, i) => {
      const fromId = String(row[mapping.noInicio!] || "").trim();
      const toId = String(row[mapping.noFim!] || "").trim();
      if (!fromId || !toId) return;

      const x = mapping.x ? pn(row[mapping.x]) ?? 0 : 0;
      const y = mapping.y ? pn(row[mapping.y]) ?? 0 : 0;
      const z = mapping.z ? pn(row[mapping.z]) ?? 0 : 0;
      if (!nodeMap.has(fromId)) nodeMap.set(fromId, { x, y, z });

      edges.push({
        id: mapping.id ? String(row[mapping.id]) : `E${String(i + 1).padStart(4, "0")}`,
        startNodeId: fromId, endNodeId: toId,
        dn: mapping.diametro ? pn(row[mapping.diametro]) ?? 200 : 200,
        material: mapping.material ? String(row[mapping.material] || "PVC") : "PVC",
        tipoRede: "Genérico",
        roughness: mapping.rugosidade ? pn(row[mapping.rugosidade]) ?? undefined : undefined,
        properties: { _source: "Tabular" },
      });
    });

    nodeMap.forEach((coords, id) => {
      nodes.push({ id, x: coords.x, y: coords.y, z: coords.z, tipo: "junction", properties: { _source: "Tabular" } });
    });
  } else {
    rows.forEach((row, i) => {
      const x = mapping.x ? pn(row[mapping.x]) : null;
      const y = mapping.y ? pn(row[mapping.y]) : null;
      if (x === null || y === null) return;
      const z = mapping.z ? pn(row[mapping.z]) ?? 0 : 0;
      const id = mapping.id ? String(row[mapping.id] || `P${String(i + 1).padStart(3, "0")}`) : `P${String(i + 1).padStart(3, "0")}`;

      let tipo: NodeType = "generic";
      if (mapping.tipo) {
        const t = String(row[mapping.tipo] || "").toLowerCase();
        if (t.includes("pv") || t.includes("poco")) tipo = "pv";
        else if (t.includes("ci")) tipo = "ci";
        else if (t.includes("reserv")) tipo = "reservoir";
        else if (t.includes("bomba") || t.includes("pump")) tipo = "pump";
      }

      nodes.push({
        id, x, y, z, tipo,
        demanda: mapping.demanda ? pn(row[mapping.demanda]) ?? undefined : undefined,
        properties: {
          label: mapping.nome ? String(row[mapping.nome] || "") : undefined,
          cotaFundo: mapping.cotaFundo ? pn(row[mapping.cotaFundo]) ?? undefined : undefined,
          profundidade: mapping.profundidade ? pn(row[mapping.profundidade]) ?? undefined : undefined,
          _source: "Tabular",
        },
      });
    });
  }

  return { nodes, edges };
}

// ════════════════════════════════════════
// MAIN IMPORT FUNCTION
// Converts parsed data → Spatial Core layers
// ════════════════════════════════════════

export function importToSpatialCore(
  parsed: InpParsed,
  options: ImportOptions
): ImportEngineResult {
  const project = getSpatialProject();
  const createdNodes: SpatialNode[] = [];
  const createdEdges: SpatialEdge[] = [];
  const drawingLayers: SpatialLayer[] = [];
  const networkLayers: SpatialLayer[] = [];

  const discipline: LayerDiscipline = options.isDrawingOnly ? "desenho" : options.discipline;
  const geomType: LayerGeometryType = parsed.edges.length > 0 ? "Mixed"
    : parsed.nodes.length > 0 ? "Point" : "Point";

  const layer = createLayer({
    name: options.layerName,
    discipline,
    geometryType: geomType,
    sourceFile: options.sourceFile,
    sourceCRS: options.crs,
    metadata: {
      modelType: options.modelType,
      isDrawingOnly: options.isDrawingOnly,
      importedAt: new Date().toISOString(),
    },
  });

  if (options.isDrawingOnly) {
    drawingLayers.push(layer);
  } else {
    networkLayers.push(layer);
  }

  for (const n of parsed.nodes) {
    const node = addNode({
      id: n.id,
      x: n.x, y: n.y, z: n.z,
      tipo: n.tipo,
      demanda: n.demanda,
      label: n.properties?.label,
      cotaFundo: n.properties?.cotaFundo,
      profundidade: n.properties?.profundidade,
      properties: n.properties || {},
      layerId: layer.id,
    });
    createdNodes.push(node);
  }

  for (const e of parsed.edges) {
    const startNode = project.nodes.get(e.startNodeId);
    const endNode = project.nodes.get(e.endNodeId);

    if (startNode && endNode) {
      const edge = addEdge({
        id: e.id,
        startNodeId: e.startNodeId,
        endNodeId: e.endNodeId,
        dn: e.dn,
        material: e.material,
        tipoRede: e.tipoRede,
        roughness: e.roughness,
        comprimento: e.properties?.length,
        vertices: e.vertices,
        properties: e.properties || {},
        layerId: layer.id,
      });
      createdEdges.push(edge);
    } else {
      const sn = startNode || { x: 0, y: 0, z: 0 };
      const en = endNode || { x: 0, y: 0, z: 0 };
      const edge = importEdgeWithAutoNodes({
        id: e.id,
        startNodeId: e.startNodeId,
        endNodeId: e.endNodeId,
        dn: e.dn,
        material: e.material,
        tipoRede: e.tipoRede,
        roughness: e.roughness,
        startX: sn.x, startY: sn.y, startZ: sn.z,
        endX: en.x, endY: en.y, endZ: en.z,
        vertices: e.vertices,
        properties: e.properties || {},
        layerId: layer.id,
      });
      createdEdges.push(edge);
    }
  }

  const validationIssues = validateProject();

  return {
    nodes: createdNodes,
    edges: createdEdges,
    drawingLayers,
    networkLayers,
    validationIssues,
    patterns: parsed.patterns,
    curves: parsed.curves,
    options: parsed.options,
    times: parsed.times,
    stats: {
      nodesCreated: createdNodes.length,
      edgesCreated: createdEdges.length,
      drawingLayersCreated: drawingLayers.length,
      networkLayersCreated: networkLayers.length,
      patternsCount: parsed.patterns?.length,
      curvesCount: parsed.curves?.length,
    },
  };
}

// ════════════════════════════════════════
// HIGH-LEVEL: importFile (auto-detect + parse + convert)
// ════════════════════════════════════════

export async function importFile(
  file: File,
  options: ImportOptions,
  rows?: Record<string, any>[]
): Promise<ImportEngineResult> {
  const content = await file.text();
  const format = detectFileFormat(file.name, content);
  let parsed: InpParsed;
  const nf = options.numericFormat || "auto";

  switch (format) {
    case "INP":
      parsed = parseINPToInternal(content);
      break;
    case "SWMM":
      parsed = parseSWMMToInternal(content);
      break;
    case "DXF":
      parsed = parseDXFToInternal(content, options.entityMappings, nf);
      break;
    case "GeoJSON":
      parsed = parseGeoJSONToInternal(content, nf);
      break;
    case "SHP": {
      const shpBuffer = await file.arrayBuffer();
      const shpResult = await parseSHPBuffer(shpBuffer);
      const shpInternal = shpFeaturesToInternal(shpResult.features);
      parsed = {
        nodes: shpInternal.nodes.map(n => ({
          ...n, tipo: n.tipo as NodeType,
        })),
        edges: shpInternal.edges,
      };
      break;
    }
    case "IFC": {
      const ifcResult = parseIFCSinglePass(content);
      const ifcInternal = ifcToInternal(ifcResult);
      parsed = {
        nodes: ifcInternal.nodes.map(n => ({
          ...n, tipo: n.tipo as NodeType,
        })),
        edges: ifcInternal.edges,
      };
      break;
    }
    case "TIF": {
      const tifBuffer = await file.arrayBuffer();
      const tifResult = await parseGeoTIFF(tifBuffer);
      const tifInternal = tifPointsToInternal(tifResult.points);
      parsed = {
        nodes: tifInternal.nodes.map(n => ({
          ...n, tipo: n.tipo as NodeType,
        })),
        edges: [],
      };
      break;
    }
    case "CSV":
    case "TXT":
    case "XLSX":
      if (rows) {
        parsed = parseTabularToInternal(rows, options.fieldMapping, nf);
      } else {
        const pontos = parseTopographyCSV(content);
        parsed = {
          nodes: pontos.map(p => ({
            id: p.id, x: p.x, y: p.y, z: p.cota,
            tipo: "generic" as NodeType,
            properties: { _source: format },
          })),
          edges: [],
        };
      }
      break;
    default:
      throw new Error(`Formato não suportado: ${format}. Use INP, DXF, SHP, GeoJSON, IFC, TIF, CSV, TXT ou XLSX.`);
  }

  return importToSpatialCore(parsed, options);
}

// ════════════════════════════════════════
// UTILITY: Check if layer is simulation-eligible
// ════════════════════════════════════════

export function isSimulationLayer(layer: SpatialLayer): boolean {
  return layer.discipline !== "desenho" && layer.metadata?.isDrawingOnly !== true;
}

export function getSimulationNodes(): SpatialNode[] {
  const project = getSpatialProject();
  const simLayerIds = new Set(
    Array.from(project.layers.values())
      .filter(isSimulationLayer)
      .map(l => l.id)
  );
  return Array.from(project.nodes.values()).filter(n => simLayerIds.has(n.layerId));
}

export function getSimulationEdges(): SpatialEdge[] {
  const project = getSpatialProject();
  const simLayerIds = new Set(
    Array.from(project.layers.values())
      .filter(isSimulationLayer)
      .map(l => l.id)
  );
  return Array.from(project.edges.values()).filter(e => simLayerIds.has(e.layerId));
}
