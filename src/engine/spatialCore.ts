/**
 * Spatial Core — Global Layer Registry, CRS Management, Topology Model
 * Implements QGIS-like spatial infrastructure for the platform.
 */

// ════════════════════════════════════════
// 1. CRS DEFINITIONS
// ════════════════════════════════════════

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

export function detectCRSFromCoordinates(x: number, y: number): CRSDefinition | null {
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  // UTM coordinates
  if (absX > 100000 && absX < 999999 && absY > 100000) {
    // Default zone 23 for Brazil
    return CRS_CATALOG.find(c => c.code === "EPSG:31983") || null;
  }
  // Geographic
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
    return CRS_CATALOG.find(c => c.code === "EPSG:4326") || null;
  }
  return null;
}

// ════════════════════════════════════════
// 2. TOPOLOGY MODEL (Nó + Trecho formais)
// ════════════════════════════════════════

export type NodeType =
  | "pv"        // Poço de Visita
  | "ci"        // Caixa de Inspeção
  | "tl"        // Terminal de Limpeza
  | "cr"        // Caixa de Reunião
  | "cp"        // Caixa de Passagem
  | "junction"  // Junção genérica
  | "reservoir" // Reservatório
  | "pump"      // Bomba
  | "outfall"   // Exutório
  | "generic";  // Genérico

export interface SpatialNode {
  id: string;
  x: number;
  y: number;
  z: number;               // Cota do terreno
  cotaFundo?: number;       // Cota de fundo (tubo)
  profundidade?: number;    // Profundidade = z - cotaFundo
  tipo: NodeType;
  demanda?: number;         // L/s
  label?: string;
  properties: Record<string, any>; // Atributos extras
  layerId: string;          // Qual layer pertence
}

export interface SpatialEdge {
  id: string;
  startNodeId: string;
  endNodeId: string;
  dn: number;               // Diâmetro nominal (mm)
  comprimento: number;       // metros
  declividade: number;       // m/m
  material: string;
  tipoRede: string;
  roughness?: number;        // Manning n
  vertices?: [number, number, number][]; // Vértices intermediários [x,y,z]
  properties: Record<string, any>;
  layerId: string;
}

// ════════════════════════════════════════
// 3. LAYER REGISTRY
// ════════════════════════════════════════

export type LayerGeometryType = "Point" | "LineString" | "Polygon" | "Mixed";
export type LayerDiscipline = "topografia" | "esgoto" | "agua" | "drenagem" | "bim" | "generico" | "desenho";

export interface SpatialLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  discipline: LayerDiscipline;
  geometryType: LayerGeometryType;
  color: string;
  opacity: number;
  sourceFile?: string;
  sourceCRS?: CRSDefinition;
  nodeIds: string[];    // References to nodes in this layer
  edgeIds: string[];    // References to edges in this layer
  metadata: Record<string, any>;
  createdAt: string;
}

export interface SpatialProject {
  crs: CRSDefinition;
  unit: "m";
  nodes: Map<string, SpatialNode>;
  edges: Map<string, SpatialEdge>;
  layers: Map<string, SpatialLayer>;
}

// ════════════════════════════════════════
// 4. SPATIAL STORE (in-memory, hybrid sync)
// ════════════════════════════════════════

let _project: SpatialProject | null = null;

export function getSpatialProject(): SpatialProject {
  if (!_project) {
    _project = createDefaultProject();
  }
  return _project;
}

export function resetSpatialProject() {
  _project = createDefaultProject();
}

function createDefaultProject(): SpatialProject {
  return {
    crs: CRS_CATALOG.find(c => c.code === "EPSG:31983")!,
    unit: "m",
    nodes: new Map(),
    edges: new Map(),
    layers: new Map(),
  };
}

export function setProjectCRS(crs: CRSDefinition) {
  getSpatialProject().crs = crs;
}

// ── Layer operations ──

let _layerCounter = 0;

export function createLayer(opts: Partial<SpatialLayer> & { name: string; discipline: LayerDiscipline; geometryType: LayerGeometryType }): SpatialLayer {
  const project = getSpatialProject();
  const id = opts.id || `layer_${++_layerCounter}_${Date.now()}`;
  const layer: SpatialLayer = {
    id,
    name: opts.name,
    visible: opts.visible ?? true,
    locked: opts.locked ?? false,
    discipline: opts.discipline,
    geometryType: opts.geometryType,
    color: opts.color || "#3b82f6",
    opacity: opts.opacity ?? 1,
    sourceFile: opts.sourceFile,
    sourceCRS: opts.sourceCRS,
    nodeIds: [],
    edgeIds: [],
    metadata: opts.metadata || {},
    createdAt: new Date().toISOString(),
  };
  project.layers.set(id, layer);
  return layer;
}

export function removeLayer(layerId: string) {
  const project = getSpatialProject();
  const layer = project.layers.get(layerId);
  if (!layer) return;
  // Remove all nodes and edges belonging to this layer
  layer.nodeIds.forEach(nId => project.nodes.delete(nId));
  layer.edgeIds.forEach(eId => project.edges.delete(eId));
  project.layers.delete(layerId);
}

export function getLayersByDiscipline(discipline: LayerDiscipline): SpatialLayer[] {
  const project = getSpatialProject();
  return Array.from(project.layers.values()).filter(l => l.discipline === discipline);
}

export function getAllLayers(): SpatialLayer[] {
  return Array.from(getSpatialProject().layers.values());
}

// ── Node operations ──

let _nodeCounter = 0;

export function addNode(node: Omit<SpatialNode, "properties"> & { properties?: Record<string, any> }): SpatialNode {
  const project = getSpatialProject();
  const fullNode: SpatialNode = { ...node, properties: node.properties || {} };
  project.nodes.set(node.id, fullNode);
  const layer = project.layers.get(node.layerId);
  if (layer && !layer.nodeIds.includes(node.id)) {
    layer.nodeIds.push(node.id);
  }
  return fullNode;
}

export function removeNode(nodeId: string, options: { removeConnectedEdges?: boolean; reconnect?: boolean } = { removeConnectedEdges: true }) {
  const project = getSpatialProject();
  const node = project.nodes.get(nodeId);
  if (!node) return;

  if (options.removeConnectedEdges) {
    const connectedEdges = getConnectedEdges(nodeId);
    connectedEdges.forEach(e => removeEdge(e.id));
  }

  // Remove from layer
  const layer = project.layers.get(node.layerId);
  if (layer) {
    layer.nodeIds = layer.nodeIds.filter(id => id !== nodeId);
  }
  project.nodes.delete(nodeId);
}

export function moveNode(nodeId: string, newX: number, newY: number, newZ?: number) {
  const project = getSpatialProject();
  const node = project.nodes.get(nodeId);
  if (!node) return;

  node.x = newX;
  node.y = newY;
  if (newZ !== undefined) node.z = newZ;

  // Update connected edges
  const connected = getConnectedEdges(nodeId);
  connected.forEach(edge => {
    recalculateEdge(edge.id);
  });
}

export function getNode(nodeId: string): SpatialNode | undefined {
  return getSpatialProject().nodes.get(nodeId);
}

export function getAllNodes(): SpatialNode[] {
  return Array.from(getSpatialProject().nodes.values());
}

export function getNodesByLayer(layerId: string): SpatialNode[] {
  return getAllNodes().filter(n => n.layerId === layerId);
}

// ── Edge operations ──

let _edgeCounter = 0;

export function addEdge(edge: Omit<SpatialEdge, "properties" | "comprimento" | "declividade"> & { properties?: Record<string, any>; comprimento?: number; declividade?: number }): SpatialEdge {
  const project = getSpatialProject();
  const startNode = project.nodes.get(edge.startNodeId);
  const endNode = project.nodes.get(edge.endNodeId);

  let comprimento = edge.comprimento ?? 0;
  let declividade = edge.declividade ?? 0;

  if (startNode && endNode) {
    if (!comprimento) {
      const dx = endNode.x - startNode.x;
      const dy = endNode.y - startNode.y;
      comprimento = Math.sqrt(dx * dx + dy * dy);
    }
    if (!declividade && comprimento > 0) {
      declividade = (startNode.z - endNode.z) / comprimento;
    }
  }

  const fullEdge: SpatialEdge = {
    ...edge,
    comprimento,
    declividade,
    properties: edge.properties || {},
  };
  project.edges.set(edge.id, fullEdge);

  const layer = project.layers.get(edge.layerId);
  if (layer && !layer.edgeIds.includes(edge.id)) {
    layer.edgeIds.push(edge.id);
  }
  return fullEdge;
}

export function removeEdge(edgeId: string) {
  const project = getSpatialProject();
  const edge = project.edges.get(edgeId);
  if (!edge) return;
  const layer = project.layers.get(edge.layerId);
  if (layer) {
    layer.edgeIds = layer.edgeIds.filter(id => id !== edgeId);
  }
  project.edges.delete(edgeId);
}

export function recalculateEdge(edgeId: string) {
  const project = getSpatialProject();
  const edge = project.edges.get(edgeId);
  if (!edge) return;
  const startNode = project.nodes.get(edge.startNodeId);
  const endNode = project.nodes.get(edge.endNodeId);
  if (!startNode || !endNode) return;

  const dx = endNode.x - startNode.x;
  const dy = endNode.y - startNode.y;
  edge.comprimento = Math.sqrt(dx * dx + dy * dy);
  if (edge.comprimento > 0) {
    edge.declividade = (startNode.z - endNode.z) / edge.comprimento;
  }
}

export function getConnectedEdges(nodeId: string): SpatialEdge[] {
  return Array.from(getSpatialProject().edges.values()).filter(
    e => e.startNodeId === nodeId || e.endNodeId === nodeId
  );
}

export function getAllEdges(): SpatialEdge[] {
  return Array.from(getSpatialProject().edges.values());
}

export function getEdgesByLayer(layerId: string): SpatialEdge[] {
  return getAllEdges().filter(e => e.layerId === layerId);
}

// ── Import helpers ──

/**
 * Imports nodes/edges and auto-creates nodes at edge endpoints if missing.
 */
export function importEdgeWithAutoNodes(
  edge: Omit<SpatialEdge, "properties" | "comprimento" | "declividade"> & {
    startX: number; startY: number; startZ: number;
    endX: number; endY: number; endZ: number;
    properties?: Record<string, any>;
  }
): SpatialEdge {
  const project = getSpatialProject();

  // Auto-create start node if not exists
  if (!project.nodes.has(edge.startNodeId)) {
    addNode({
      id: edge.startNodeId,
      x: edge.startX, y: edge.startY, z: edge.startZ,
      tipo: "junction",
      layerId: edge.layerId,
    });
  }

  // Auto-create end node if not exists
  if (!project.nodes.has(edge.endNodeId)) {
    addNode({
      id: edge.endNodeId,
      x: edge.endX, y: edge.endY, z: edge.endZ,
      tipo: "junction",
      layerId: edge.layerId,
    });
  }

  return addEdge(edge);
}

// ── Validation ──

export interface ValidationIssue {
  type: "duplicate_node" | "disconnected_edge" | "invalid_geometry" | "crs_mismatch" | "negative_z" | "length_mismatch" | "missing_z";
  severity: "error" | "warning" | "info";
  message: string;
  elementId?: string;
}

export function validateProject(): ValidationIssue[] {
  const project = getSpatialProject();
  const issues: ValidationIssue[] = [];

  // Check duplicate node positions
  const nodePositions = new Map<string, string>();
  project.nodes.forEach((node) => {
    const key = `${node.x.toFixed(3)},${node.y.toFixed(3)}`;
    if (nodePositions.has(key)) {
      issues.push({
        type: "duplicate_node",
        severity: "warning",
        message: `Nó ${node.id} na mesma posição que ${nodePositions.get(key)}`,
        elementId: node.id,
      });
    }
    nodePositions.set(key, node.id);
  });

  // Check edges with missing nodes
  project.edges.forEach((edge) => {
    if (!project.nodes.has(edge.startNodeId)) {
      issues.push({
        type: "disconnected_edge",
        severity: "error",
        message: `Trecho ${edge.id}: nó início '${edge.startNodeId}' não encontrado`,
        elementId: edge.id,
      });
    }
    if (!project.nodes.has(edge.endNodeId)) {
      issues.push({
        type: "disconnected_edge",
        severity: "error",
        message: `Trecho ${edge.id}: nó fim '${edge.endNodeId}' não encontrado`,
        elementId: edge.id,
      });
    }
  });

  // Check negative Z
  project.nodes.forEach((node) => {
    if (node.z < -100) {
      issues.push({
        type: "negative_z",
        severity: "warning",
        message: `Nó ${node.id}: Z muito negativo (${node.z.toFixed(2)})`,
        elementId: node.id,
      });
    }
  });

  // Check zero-length edges
  project.edges.forEach((edge) => {
    if (edge.comprimento <= 0.001) {
      issues.push({
        type: "length_mismatch",
        severity: "error",
        message: `Trecho ${edge.id}: comprimento zero ou negativo`,
        elementId: edge.id,
      });
    }
  });

  // Check nodes with no Z
  project.nodes.forEach((node) => {
    if (node.z === 0) {
      issues.push({
        type: "missing_z",
        severity: "info",
        message: `Nó ${node.id}: sem elevação (Z=0)`,
        elementId: node.id,
      });
    }
  });

  return issues;
}

// ── Serialization for persistence ──

export interface SerializedSpatialProject {
  crs: CRSDefinition;
  nodes: SpatialNode[];
  edges: SpatialEdge[];
  layers: SpatialLayer[];
}

export function serializeProject(): SerializedSpatialProject {
  const project = getSpatialProject();
  return {
    crs: project.crs,
    nodes: Array.from(project.nodes.values()),
    edges: Array.from(project.edges.values()),
    layers: Array.from(project.layers.values()),
  };
}

export function deserializeProject(data: SerializedSpatialProject) {
  const project = getSpatialProject();
  project.crs = data.crs;
  project.nodes = new Map(data.nodes.map(n => [n.id, n]));
  project.edges = new Map(data.edges.map(e => [e.id, e]));
  project.layers = new Map(data.layers.map(l => [l.id, l]));
}

// ── Convert from legacy PontoTopografico/Trecho ──

import { PontoTopografico } from "./reader";
import { Trecho } from "./domain";

export function legacyPointsToNodes(pontos: PontoTopografico[], layerId: string): SpatialNode[] {
  return pontos.map(p => ({
    id: p.id,
    x: p.x,
    y: p.y,
    z: p.cota,
    tipo: "generic" as NodeType,
    properties: {},
    layerId,
  }));
}

export function legacyTrechosToEdges(trechos: Trecho[], layerId: string): SpatialEdge[] {
  return trechos.map((t, i) => ({
    id: `edge_${i}_${t.idInicio}_${t.idFim}`,
    startNodeId: t.idInicio,
    endNodeId: t.idFim,
    dn: t.diametroMm,
    comprimento: t.comprimento,
    declividade: t.declividade,
    material: t.material,
    tipoRede: t.tipoRede,
    properties: {},
    layerId,
  }));
}

export function nodesToLegacyPoints(nodes: SpatialNode[]): PontoTopografico[] {
  return nodes.map(n => ({ id: n.id, x: n.x, y: n.y, cota: n.z }));
}

export function edgesToLegacyTrechos(edges: SpatialEdge[], nodes: Map<string, SpatialNode>): Trecho[] {
  return edges.map(e => {
    const start = nodes.get(e.startNodeId);
    const end = nodes.get(e.endNodeId);
    return {
      idInicio: e.startNodeId,
      idFim: e.endNodeId,
      comprimento: e.comprimento,
      declividade: e.declividade,
      tipoRede: e.tipoRede as any,
      diametroMm: e.dn,
      material: e.material,
      xInicio: start?.x ?? 0,
      yInicio: start?.y ?? 0,
      cotaInicio: start?.z ?? 0,
      xFim: end?.x ?? 0,
      yFim: end?.y ?? 0,
      cotaFim: end?.z ?? 0,
    };
  });
}
