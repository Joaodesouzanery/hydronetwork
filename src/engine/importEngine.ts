/**
 * ImportEngine — Unified import layer that converts ANY file format
 * into the internal Spatial Core model (nodes + edges + drawing_layers).
 *
 * Supported: INP, DXF, GeoJSON, CSV, TXT, XLSX, SHP(json), IFC(json), SWMM
 *
 * EPANET PRO is a CONSUMER only — it reads nodes/edges from the Spatial Core.
 * This engine NEVER modifies simulation parameters.
 */

import { PontoTopografico, parseTopographyCSV, parseTopographyXLSX } from "./reader";
import { parseDxfToPoints, extractDxfLayers, parseDxfEntities, DxfEntity } from "./dxfReader";
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
  // Remove currency symbols, spaces, and non-breaking spaces
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
    // Auto-detect
    if (lastComma > lastDot) {
      // e.g. "362.285,523" → comma is decimal
      isCommaDecimal = true;
    } else if (lastDot > lastComma) {
      // e.g. "362,285.523" → dot is decimal
      isCommaDecimal = false;
    } else if (lastComma >= 0 && lastDot < 0) {
      // Only commas: check if it's a decimal separator
      // If digits after comma are not exactly 3, treat as decimal
      const afterComma = str.substring(lastComma + 1);
      isCommaDecimal = afterComma.length !== 3 || str.indexOf(",") === lastComma;
    } else if (lastDot >= 0 && lastComma < 0) {
      // Only dots: check pattern
      const dotCount = (str.match(/\./g) || []).length;
      if (dotCount > 1) {
        // Multiple dots = thousand separators (Brazilian)
        isCommaDecimal = true; // dots are thousands
      } else {
        isCommaDecimal = false; // single dot = decimal (American)
      }
    } else {
      isCommaDecimal = false; // no separators
    }
  }

  if (isCommaDecimal) {
    str = str.replace(/\./g, ""); // remove thousand separators
    str = str.replace(",", "."); // convert decimal comma to dot
  } else {
    str = str.replace(/,/g, ""); // remove thousand separators
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
  | "CSV" | "TXT" | "XLSX" | "IFC" | "SWMM" | "Unknown";

export type ImportModelType = "rede" | "topografia" | "bim" | "generico" | "desenho";

/** How to interpret geometric files: by geometry or by tabular fields */
export type ImportMode = "geometric" | "tabular";

/** Entity-level import role assignment */
export type EntityImportRole = "edge" | "node" | "ignore";

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
  stats: {
    nodesCreated: number;
    edgesCreated: number;
    drawingLayersCreated: number;
    networkLayersCreated: number;
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
  snapTolerance?: number; // in CRS units, default 0.001
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

export interface InpParsed {
  nodes: Array<{ id: string; x: number; y: number; z: number; tipo: NodeType; demanda?: number; properties: Record<string, any> }>;
  edges: Array<{
    id: string; startNodeId: string; endNodeId: string; dn: number;
    material: string; tipoRede: string; roughness?: number;
    vertices?: [number, number, number][];
    properties: Record<string, any>;
  }>;
}

export function parseINPToInternal(content: string): InpParsed {
  const lines = content.split(/\r?\n/);
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];
  const coordMap = new Map<string, { x: number; y: number }>();
  let section = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("[")) { section = line.toUpperCase().replace(/\s/g, ""); continue; }
    if (!line || line.startsWith(";")) continue;
    const dataLine = line.split(";")[0].trim();
    if (!dataLine) continue;
    const p = dataLine.split(/[\s\t]+/).filter(Boolean);
    if (section === "[COORDINATES]" && p.length >= 3) {
      coordMap.set(p[0], { x: +p[1], y: +p[2] });
    }
  }

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
          nodes.push({
            id: p[0], x: coord.x, y: coord.y, z: +p[1],
            tipo: "junction", demanda: p.length >= 3 ? +p[2] : undefined,
            properties: { elevation: +p[1], demand: p.length >= 3 ? +p[2] : 0, pattern: p[3] || "", _source: "INP" },
          });
        }
        break;
      case "[RESERVOIRS]":
        if (p.length >= 2) {
          const coord = coordMap.get(p[0]) || { x: 0, y: 0 };
          nodes.push({
            id: p[0], x: coord.x, y: coord.y, z: +p[1],
            tipo: "reservoir",
            properties: { head: +p[1], pattern: p[2] || "", _source: "INP" },
          });
        }
        break;
      case "[TANKS]":
        if (p.length >= 6) {
          const coord = coordMap.get(p[0]) || { x: 0, y: 0 };
          nodes.push({
            id: p[0], x: coord.x, y: coord.y, z: +p[1],
            tipo: "reservoir",
            properties: { elevation: +p[1], initLevel: +p[2], minLevel: +p[3], maxLevel: +p[4], diameter: +p[5], _source: "INP", _type: "tank" },
          });
        }
        break;
      case "[PIPES]":
        if (p.length >= 6) {
          edges.push({
            id: p[0], startNodeId: p[1], endNodeId: p[2],
            dn: +p[4], material: p.length >= 8 ? p[7] : "PVC",
            tipoRede: "Rede de Água", roughness: +p[5],
            properties: { length: +p[3], diameter: +p[4], roughness: +p[5], _source: "INP" },
          });
        }
        break;
      case "[PUMPS]":
        if (p.length >= 3) {
          const powerIdx = p.findIndex(v => v.toUpperCase() === "POWER");
          const power = powerIdx >= 0 && p[powerIdx + 1] ? +p[powerIdx + 1] : (+p[3] || 10);
          edges.push({
            id: p[0], startNodeId: p[1], endNodeId: p[2],
            dn: 0, material: "Bomba", tipoRede: "Recalque",
            properties: { power, _source: "INP", _type: "pump" },
          });
        }
        break;
      case "[VALVES]":
        if (p.length >= 6) {
          edges.push({
            id: p[0], startNodeId: p[1], endNodeId: p[2],
            dn: +p[3], material: "Válvula", tipoRede: "Rede de Água",
            properties: { valveType: p[4], setting: +p[5], _source: "INP", _type: "valve" },
          });
        }
        break;
    }
  }

  return { nodes, edges };
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
// Lines become edges with auto-generated nodes
// ════════════════════════════════════════

export function parseGeoJSONToInternal(content: string, numericFormat: NumericFormat = "auto"): InpParsed {
  const geojson = JSON.parse(content);
  const features = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];
  const nodeIndex = new Map<string, string>(); // coordKey → nodeId
  let nodeCounter = 0;
  let edgeCounter = 0;

  const tolerance = 6; // decimal places for coord key

  function getOrCreateNode(x: number, y: number, z: number): string {
    const key = `${x.toFixed(tolerance)},${y.toFixed(tolerance)}`;
    if (nodeIndex.has(key)) return nodeIndex.get(key)!;
    const id = `GJ_N${++nodeCounter}`;
    nodeIndex.set(key, id);
    nodes.push({ id, x, y, z, tipo: "junction", properties: { _source: "GeoJSON" } });
    return id;
  }

  for (const feature of features) {
    const geom = feature.geometry;
    const props = feature.properties || {};
    if (!geom) continue;

    if (geom.type === "Point") {
      const [x, y, z] = geom.coordinates;
      const id = props.id || props.ID || `GJ_N${++nodeCounter}`;
      nodeIndex.set(`${x.toFixed(tolerance)},${y.toFixed(tolerance)}`, id);
      nodes.push({ id, x, y, z: z || 0, tipo: "generic", properties: { ...props, _source: "GeoJSON" } });
    } else if (geom.type === "LineString") {
      const coords: number[][] = geom.coordinates;
      const first = coords[0];
      const last = coords[coords.length - 1];
      const startId = getOrCreateNode(first[0], first[1], first[2] || 0);
      const endId = getOrCreateNode(last[0], last[1], last[2] || 0);
      
      // Store intermediate vertices
      const vertices: [number, number, number][] = coords.map(c => [c[0], c[1], c[2] || 0] as [number, number, number]);

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
  const nodeIndex = new Map<string, string>(); // coordKey → nodeId
  let nodeCounter = 0;
  let edgeCounter = 0;
  const snapDecimals = 4;

  // Build role lookup from entity mappings
  const roleMap = new Map<string, EntityImportRole>();
  if (entityMappings) {
    entityMappings.forEach(m => roleMap.set(m.entityType.toUpperCase(), m.role));
  } else {
    // Default: lines→edge, points→node
    roleMap.set("LINE", "edge");
    roleMap.set("LWPOLYLINE", "edge");
    roleMap.set("POLYLINE", "edge");
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
    if (role === "ignore") continue;

    if (role === "node") {
      if (e.x !== undefined && e.y !== undefined) {
        const id = getOrCreateNode(e.x, e.y, e.z ?? 0, e.layer);
        // Update tipo if INSERT (usually PV, CI, etc.)
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
      } else if (e.type === "LWPOLYLINE" || e.type === "POLYLINE") {
        const verts: { x: number; y: number; z: number }[] = [];
        if (e.vertices && e.vertices.length > 0) {
          verts.push(...e.vertices);
        }
        // For LWPOLYLINE, the first vertex may be stored as x,y,z
        if (verts.length === 0 && e.x !== undefined && e.y !== undefined) {
          verts.push({ x: e.x, y: e.y, z: e.z ?? 0 });
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
    stats: {
      nodesCreated: createdNodes.length,
      edgesCreated: createdEdges.length,
      drawingLayersCreated: drawingLayers.length,
      networkLayersCreated: networkLayers.length,
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
      throw new Error(`Formato não suportado: ${format}. Use INP, DXF, GeoJSON, CSV, TXT ou XLSX.`);
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
