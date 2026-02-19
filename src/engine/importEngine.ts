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
import { parseDxfToPoints, extractDxfLayers } from "./dxfReader";
import {
  SpatialNode, SpatialEdge, SpatialLayer, CRSDefinition, CRS_CATALOG,
  NodeType, LayerDiscipline, LayerGeometryType,
  createLayer, addNode, addEdge, getSpatialProject,
  detectCRSFromCoordinates, importEdgeWithAutoNodes,
  validateProject, ValidationIssue,
} from "./spatialCore";

// ════════════════════════════════════════
// TYPES
// ════════════════════════════════════════

export type ImportFileFormat =
  | "INP" | "DXF" | "DWG" | "SHP" | "GeoJSON"
  | "CSV" | "TXT" | "XLSX" | "IFC" | "SWMM" | "Unknown";

export type ImportModelType = "rede" | "topografia" | "bim" | "generico" | "desenho";

export interface ImportedRecord {
  [key: string]: any;
}

export interface ImportEngineResult {
  nodes: SpatialNode[];
  edges: SpatialEdge[];
  drawingLayers: SpatialLayer[];      // layers flagged as visual-only (no simulation)
  networkLayers: SpatialLayer[];      // layers available for simulation
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
  isDrawingOnly: boolean;  // if true, layer won't enter simulation
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
      // Check SWMM by content
      if (content && content.includes("[SUBCATCHMENTS]")) return "SWMM";
      return "Unknown";
    }
  }
}

// ════════════════════════════════════════
// INP PARSER (EPANET format → internal model)
// Maps: JUNCTIONS→nodes, PIPES→edges, RESERVOIRS→nodes, PUMPS→edges, VALVES→edges
// Does NOT alter hydraulic parameters.
// ════════════════════════════════════════

interface InpParsed {
  nodes: Array<{ id: string; x: number; y: number; z: number; tipo: NodeType; demanda?: number; properties: Record<string, any> }>;
  edges: Array<{ id: string; startNodeId: string; endNodeId: string; dn: number; material: string; tipoRede: string; roughness?: number; properties: Record<string, any> }>;
}

export function parseINPToInternal(content: string): InpParsed {
  const lines = content.split(/\r?\n/);
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];
  const coordMap = new Map<string, { x: number; y: number }>();
  let section = "";

  // First pass: extract coordinates
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

  // Second pass: extract elements
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

  // First pass: coordinates
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
// GEOJSON PARSER → internal model
// ════════════════════════════════════════

export function parseGeoJSONToInternal(content: string): InpParsed {
  const geojson = JSON.parse(content);
  const features = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];
  let nodeCounter = 0;
  let edgeCounter = 0;

  for (const feature of features) {
    const geom = feature.geometry;
    const props = feature.properties || {};
    if (!geom) continue;

    if (geom.type === "Point") {
      const [x, y, z] = geom.coordinates;
      nodes.push({
        id: props.id || props.ID || `GJ_N${++nodeCounter}`,
        x, y, z: z || 0, tipo: "generic",
        properties: { ...props, _source: "GeoJSON" },
      });
    } else if (geom.type === "LineString") {
      const coords: number[][] = geom.coordinates;
      const startId = props.from || props.node1 || `GJ_N${++nodeCounter}`;
      const endId = props.to || props.node2 || `GJ_N${++nodeCounter}`;
      // Auto-create start/end nodes
      if (!nodes.find(n => n.id === startId)) {
        nodes.push({ id: startId, x: coords[0][0], y: coords[0][1], z: coords[0][2] || 0, tipo: "junction", properties: { _source: "GeoJSON" } });
      }
      const last = coords[coords.length - 1];
      if (!nodes.find(n => n.id === endId)) {
        nodes.push({ id: endId, x: last[0], y: last[1], z: last[2] || 0, tipo: "junction", properties: { _source: "GeoJSON" } });
      }
      edges.push({
        id: props.id || `GJ_E${++edgeCounter}`,
        startNodeId: startId, endNodeId: endId,
        dn: props.diameter || props.dn || 200,
        material: props.material || "PVC",
        tipoRede: props.tipoRede || "Genérico",
        roughness: props.roughness,
        properties: { ...props, _source: "GeoJSON" },
      });
    }
  }

  return { nodes, edges };
}

// ════════════════════════════════════════
// DXF → internal model
// ════════════════════════════════════════

export function parseDXFToInternal(content: string): InpParsed {
  const points = parseDxfToPoints(content);
  const nodes: InpParsed["nodes"] = points.map(p => ({
    id: p.id, x: p.x, y: p.y, z: p.cota,
    tipo: "generic" as NodeType,
    properties: { layer: p.layer, entityType: p.entityType, _source: "DXF" },
  }));
  return { nodes, edges: [] };
}

// ════════════════════════════════════════
// GENERIC TABULAR (CSV/TXT/XLSX) → internal model
// Uses field mapping from user
// ════════════════════════════════════════

export function parseTabularToInternal(
  rows: Record<string, any>[],
  mapping: FieldMapping
): InpParsed {
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];
  const isEdgeMode = !!mapping.noInicio && !!mapping.noFim;

  if (isEdgeMode) {
    const nodeMap = new Map<string, { x: number; y: number; z: number }>();
    rows.forEach((row, i) => {
      const fromId = String(row[mapping.noInicio!] || "").trim();
      const toId = String(row[mapping.noFim!] || "").trim();
      if (!fromId || !toId) return;

      const x = mapping.x ? parseFloat(String(row[mapping.x])) : 0;
      const y = mapping.y ? parseFloat(String(row[mapping.y])) : 0;
      const z = mapping.z ? parseFloat(String(row[mapping.z])) : 0;
      if (!nodeMap.has(fromId)) nodeMap.set(fromId, { x, y, z: isNaN(z) ? 0 : z });

      edges.push({
        id: mapping.id ? String(row[mapping.id]) : `E${String(i + 1).padStart(4, "0")}`,
        startNodeId: fromId, endNodeId: toId,
        dn: mapping.diametro ? parseFloat(String(row[mapping.diametro])) || 200 : 200,
        material: mapping.material ? String(row[mapping.material] || "PVC") : "PVC",
        tipoRede: "Genérico",
        roughness: mapping.rugosidade ? parseFloat(String(row[mapping.rugosidade])) : undefined,
        properties: { _source: "Tabular" },
      });
    });

    nodeMap.forEach((coords, id) => {
      nodes.push({ id, x: coords.x, y: coords.y, z: coords.z, tipo: "junction", properties: { _source: "Tabular" } });
    });
  } else {
    rows.forEach((row, i) => {
      const x = mapping.x ? parseFloat(String(row[mapping.x])) : NaN;
      const y = mapping.y ? parseFloat(String(row[mapping.y])) : NaN;
      if (isNaN(x) || isNaN(y)) return;
      const z = mapping.z ? parseFloat(String(row[mapping.z])) : 0;
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
        id, x, y, z: isNaN(z) ? 0 : z, tipo,
        demanda: mapping.demanda ? parseFloat(String(row[mapping.demanda])) : undefined,
        properties: {
          label: mapping.nome ? String(row[mapping.nome] || "") : undefined,
          cotaFundo: mapping.cotaFundo ? parseFloat(String(row[mapping.cotaFundo])) : undefined,
          profundidade: mapping.profundidade ? parseFloat(String(row[mapping.profundidade])) : undefined,
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

  // Determine discipline
  const discipline: LayerDiscipline = options.isDrawingOnly ? "desenho" : options.discipline;
  const geomType: LayerGeometryType = parsed.edges.length > 0 ? "Mixed"
    : parsed.nodes.length > 0 ? "Point" : "Point";

  // Create layer
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

  // Add nodes
  for (const n of parsed.nodes) {
    const node = addNode({
      id: n.id,
      x: n.x,
      y: n.y,
      z: n.z,
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

  // Add edges (auto-creates nodes at endpoints if missing)
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
        properties: e.properties || {},
        layerId: layer.id,
      });
      createdEdges.push(edge);
    } else {
      // Auto-create missing nodes at (0,0,0) — they need coordinates
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
        properties: e.properties || {},
        layerId: layer.id,
      });
      createdEdges.push(edge);
    }
  }

  // Run validation (read-only, never auto-corrects)
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
  rows?: Record<string, any>[]  // pre-parsed rows for tabular formats
): Promise<ImportEngineResult> {
  const content = await file.text();
  const format = detectFileFormat(file.name, content);
  let parsed: InpParsed;

  switch (format) {
    case "INP":
      parsed = parseINPToInternal(content);
      break;
    case "SWMM":
      parsed = parseSWMMToInternal(content);
      break;
    case "DXF":
      parsed = parseDXFToInternal(content);
      break;
    case "GeoJSON":
      parsed = parseGeoJSONToInternal(content);
      break;
    case "CSV":
    case "TXT":
    case "XLSX":
      if (rows) {
        parsed = parseTabularToInternal(rows, options.fieldMapping);
      } else {
        // Fallback: parse as topography CSV
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
// Drawing layers NEVER enter EPANET/SWMM
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
