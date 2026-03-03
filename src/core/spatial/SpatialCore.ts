/**
 * Spatial Core — Central node/edge store with topology management.
 * Implements QGIS-like spatial infrastructure.
 *
 * This is the canonical source of truth for all spatial data.
 */

import { CRSDefinition, getDefaultCRS } from "./ProjectCRS";
import {
  SpatialLayer, LayerDiscipline, LayerGeometryType, LayerMetadata,
  LayerRegistryStore, createLayerRegistryStore,
  createLayer as _createLayer, removeLayer as _removeLayer,
  getLayersByDiscipline as _getLayersByDiscipline,
  getAllLayers as _getAllLayers, getSimulationLayers as _getSimulationLayers,
  getLayersByOrigin as _getLayersByOrigin,
  OriginModule,
} from "./LayerRegistry";

// ════════════════════════════════════════
// NODE & EDGE TYPES
// ════════════════════════════════════════

export type NodeType =
  | "pv"        // Poço de Visita
  | "ci"        // Caixa de Inspeção
  | "tl"        // Terminal de Limpeza
  | "cr"        // Caixa de Reunião
  | "cp"        // Caixa de Passagem
  | "junction"  // Junção genérica
  | "reservoir" // Reservatório
  | "tank"      // Tanque
  | "pump"      // Bomba
  | "outfall"   // Exutório
  | "manhole"   // Poço de visita genérico
  | "generic";  // Genérico

export interface SpatialNode {
  id: string;
  x: number;
  y: number;
  z: number;               // Cota do terreno (groundElevation)
  cotaFundo?: number;       // Cota de fundo (invertElevation)
  profundidade?: number;    // Profundidade = z - cotaFundo
  tipo: NodeType;
  demanda?: number;         // L/s
  label?: string;
  properties: Record<string, any>;
  layerId: string;
  origin_module?: OriginModule;
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
  vertices?: [number, number, number][];
  properties: Record<string, any>;
  layerId: string;
  origin_module?: OriginModule;
}

// ════════════════════════════════════════
// PROJECT STORE (in-memory, hybrid sync)
// ════════════════════════════════════════

export interface SpatialProject {
  crs: CRSDefinition;
  unit: "m";
  nodes: Map<string, SpatialNode>;
  edges: Map<string, SpatialEdge>;
  layers: Map<string, SpatialLayer>;
}

let _project: SpatialProject | null = null;

export function getSpatialProject(): SpatialProject {
  if (!_project) _project = createDefaultProject();
  return _project;
}

export function resetSpatialProject() {
  _project = createDefaultProject();
}

function createDefaultProject(): SpatialProject {
  return {
    crs: getDefaultCRS(),
    unit: "m",
    nodes: new Map(),
    edges: new Map(),
    layers: new Map(),
  };
}

export function setProjectCRS(crs: CRSDefinition) {
  getSpatialProject().crs = crs;
}

// ── Layer operations (delegated) ──

function getLayerStore(): LayerRegistryStore {
  const p = getSpatialProject();
  return { layers: p.layers };
}

export function createLayer(opts: Partial<SpatialLayer> & { name: string; discipline: LayerDiscipline; geometryType: LayerGeometryType }): SpatialLayer {
  return _createLayer(getLayerStore(), opts);
}

export function removeLayer(layerId: string) {
  const project = getSpatialProject();
  const layer = project.layers.get(layerId);
  if (!layer) return;
  layer.nodeIds.forEach(nId => project.nodes.delete(nId));
  layer.edgeIds.forEach(eId => project.edges.delete(eId));
  project.layers.delete(layerId);
}

export function getLayersByDiscipline(discipline: LayerDiscipline): SpatialLayer[] {
  return _getLayersByDiscipline(getLayerStore(), discipline);
}

export function getAllLayers(): SpatialLayer[] {
  return _getAllLayers(getLayerStore());
}

export function getLayersByOrigin(origin: OriginModule): SpatialLayer[] {
  return _getLayersByOrigin(getLayerStore(), origin);
}

// ── Node operations ──

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

  // Update connected edges (topology rule: move node → update edges)
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

export function getNodesByOrigin(origin: OriginModule): SpatialNode[] {
  const originLayerIds = new Set(getLayersByOrigin(origin).map(l => l.id));
  return getAllNodes().filter(n => n.origin_module === origin || originLayerIds.has(n.layerId));
}

// ── Edge operations ──

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

export function getEdgesByOrigin(origin: OriginModule): SpatialEdge[] {
  const originLayerIds = new Set(getLayersByOrigin(origin).map(l => l.id));
  return getAllEdges().filter(e => e.origin_module === origin || originLayerIds.has(e.layerId));
}

// ── Import helper: auto-create nodes at endpoints ──

export function importEdgeWithAutoNodes(
  edge: Omit<SpatialEdge, "properties" | "comprimento" | "declividade"> & {
    startX: number; startY: number; startZ: number;
    endX: number; endY: number; endZ: number;
    properties?: Record<string, any>;
  }
): SpatialEdge {
  const project = getSpatialProject();

  if (!project.nodes.has(edge.startNodeId)) {
    addNode({
      id: edge.startNodeId,
      x: edge.startX, y: edge.startY, z: edge.startZ,
      tipo: "junction",
      layerId: edge.layerId,
    });
  }

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

// ── Simulation layer helpers ──

export function getSimulationNodes(): SpatialNode[] {
  const project = getSpatialProject();
  const simLayerIds = new Set(
    _getSimulationLayers(getLayerStore()).map(l => l.id)
  );
  return Array.from(project.nodes.values()).filter(n => simLayerIds.has(n.layerId));
}

export function getSimulationEdges(): SpatialEdge[] {
  const project = getSpatialProject();
  const simLayerIds = new Set(
    _getSimulationLayers(getLayerStore()).map(l => l.id)
  );
  return Array.from(project.edges.values()).filter(e => simLayerIds.has(e.layerId));
}

// ── Serialization ──

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

// ── Legacy conversion ──

import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";

export function legacyPointsToNodes(pontos: PontoTopografico[], layerId: string): SpatialNode[] {
  return pontos.map(p => ({
    id: p.id, x: p.x, y: p.y, z: p.cota,
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
