/**
 * Module Sync — Synchronization layer between Spatial Core and simulation modules.
 *
 * EPANET/SWMM/Planning CONSUME data from Spatial Core.
 * Nothing is duplicated. Single source of truth.
 */

import {
  getSpatialProject, getAllNodes, getAllEdges,
  getLayersByDiscipline, getLayersByOrigin, getAllLayers,
  SpatialNode, SpatialEdge, SpatialLayer,
  OriginModule,
} from "@/core/spatial";
import { isSimulationLayer } from "@/core/spatial/LayerRegistry";

// ════════════════════════════════════════
// EPANET INPUT
// ════════════════════════════════════════

export interface EPANETInput {
  nodes: SpatialNode[];
  edges: SpatialEdge[];
  junctions: SpatialNode[];
  reservoirs: SpatialNode[];
  tanks: SpatialNode[];
  pipes: SpatialEdge[];
  pumps: SpatialEdge[];
  valves: SpatialEdge[];
}

export function getDataForEPANET(originFilter?: OriginModule): EPANETInput {
  let waterLayers = getLayersByDiscipline("agua");
  let genericLayers = getLayersByDiscipline("generico");
  if (originFilter) {
    waterLayers = waterLayers.filter(l => l.originModule === originFilter);
    genericLayers = genericLayers.filter(l => l.originModule === originFilter);
  }
  const relevantLayerIds = new Set([...waterLayers, ...genericLayers].map(l => l.id));

  const project = getSpatialProject();
  const nodes = Array.from(project.nodes.values()).filter(n => relevantLayerIds.has(n.layerId));
  const edges = Array.from(project.edges.values()).filter(e => relevantLayerIds.has(e.layerId));

  return {
    nodes,
    edges,
    junctions: nodes.filter(n => n.tipo === "junction" || n.tipo === "generic"),
    reservoirs: nodes.filter(n => n.tipo === "reservoir"),
    tanks: nodes.filter(n => n.tipo === "reservoir" && n.properties?._type === "tank"),
    pipes: edges.filter(e => !e.properties?._type || e.properties?._type === "pipe"),
    pumps: edges.filter(e => e.properties?._type === "pump"),
    valves: edges.filter(e => e.properties?._type === "valve"),
  };
}

// ════════════════════════════════════════
// SWMM INPUT
// ════════════════════════════════════════

export interface SWMMInput {
  nodes: SpatialNode[];
  edges: SpatialEdge[];
  junctions: SpatialNode[];
  outfalls: SpatialNode[];
  conduits: SpatialEdge[];
}

export function getDataForSWMM(): SWMMInput {
  const sewerLayers = getLayersByDiscipline("esgoto");
  const drainageLayers = getLayersByDiscipline("drenagem");
  const relevantLayerIds = new Set([...sewerLayers, ...drainageLayers].map(l => l.id));

  const project = getSpatialProject();
  const nodes = Array.from(project.nodes.values()).filter(n => relevantLayerIds.has(n.layerId));
  const edges = Array.from(project.edges.values()).filter(e => relevantLayerIds.has(e.layerId));

  return {
    nodes,
    edges,
    junctions: nodes.filter(n => n.tipo !== "outfall"),
    outfalls: nodes.filter(n => n.tipo === "outfall"),
    conduits: edges,
  };
}

// ════════════════════════════════════════
// PLANNING INPUT
// ════════════════════════════════════════

export interface PlanningInput {
  totalLength: number;
  totalNodes: number;
  totalEdges: number;
  quantities: Record<string, { length: number; count: number; diameter?: number; material?: string }>;
  layerSummary: Array<{ name: string; discipline: string; nodeCount: number; edgeCount: number; length: number }>;
}

export function getDataForPlanning(): PlanningInput {
  const allLayers = getAllLayers().filter(isSimulationLayer);
  const project = getSpatialProject();

  let totalLength = 0;
  let totalNodes = 0;
  let totalEdges = 0;
  const quantities: PlanningInput["quantities"] = {};
  const layerSummary: PlanningInput["layerSummary"] = [];

  for (const layer of allLayers) {
    const layerNodes = layer.nodeIds.length;
    const layerEdges = layer.edgeIds;
    let layerLength = 0;

    for (const eId of layerEdges) {
      const edge = project.edges.get(eId);
      if (edge) {
        layerLength += edge.comprimento;
        totalLength += edge.comprimento;

        const key = `${edge.material}_DN${edge.dn}`;
        if (!quantities[key]) {
          quantities[key] = { length: 0, count: 0, diameter: edge.dn, material: edge.material };
        }
        quantities[key].length += edge.comprimento;
        quantities[key].count++;
      }
    }

    totalNodes += layerNodes;
    totalEdges += layerEdges.length;

    layerSummary.push({
      name: layer.name,
      discipline: layer.discipline,
      nodeCount: layerNodes,
      edgeCount: layerEdges.length,
      length: Math.round(layerLength * 100) / 100,
    });
  }

  return {
    totalLength: Math.round(totalLength * 100) / 100,
    totalNodes,
    totalEdges,
    quantities,
    layerSummary,
  };
}

// ════════════════════════════════════════
// BUDGET/QUANTITIES
// ════════════════════════════════════════

export function calculateTotalLength(layers?: SpatialLayer[]): number {
  const project = getSpatialProject();
  const targetLayers = layers || getAllLayers().filter(isSimulationLayer);

  let total = 0;
  for (const layer of targetLayers) {
    for (const eId of layer.edgeIds) {
      const edge = project.edges.get(eId);
      if (edge) total += edge.comprimento;
    }
  }
  return Math.round(total * 100) / 100;
}

export function calculateQuantities(layers?: SpatialLayer[]): Record<string, number> {
  const project = getSpatialProject();
  const targetLayers = layers || getAllLayers().filter(isSimulationLayer);
  const quantities: Record<string, number> = {};

  for (const layer of targetLayers) {
    for (const eId of layer.edgeIds) {
      const edge = project.edges.get(eId);
      if (edge) {
        const key = `${edge.material} DN${edge.dn}mm`;
        quantities[key] = (quantities[key] || 0) + edge.comprimento;
      }
    }
  }

  return quantities;
}

// ════════════════════════════════════════
// QWATER INPUT
// ════════════════════════════════════════

export interface QWaterInput {
  nodes: SpatialNode[];
  edges: SpatialEdge[];
  junctions: SpatialNode[];
  reservoirs: SpatialNode[];
  tanks: SpatialNode[];
  pipes: SpatialEdge[];
  pumps: SpatialEdge[];
  valves: SpatialEdge[];
}

export function getDataForQWater(originFilter?: OriginModule): QWaterInput {
  const originLayers = getLayersByOrigin("qwater");
  const disciplineLayers = getLayersByDiscipline("agua");
  const merged = new Map<string, SpatialLayer>();
  for (const l of [...originLayers, ...disciplineLayers]) merged.set(l.id, l);
  let layers = Array.from(merged.values());
  if (originFilter) {
    layers = layers.filter(l => l.originModule === originFilter);
  }
  const relevantLayerIds = new Set(layers.map(l => l.id));

  const project = getSpatialProject();
  const nodes = Array.from(project.nodes.values()).filter(n => relevantLayerIds.has(n.layerId));
  const edges = Array.from(project.edges.values()).filter(e => relevantLayerIds.has(e.layerId));

  return {
    nodes,
    edges,
    junctions: nodes.filter(n => n.tipo === "junction" || n.tipo === "generic"),
    reservoirs: nodes.filter(n => n.tipo === "reservoir"),
    tanks: nodes.filter(n => n.tipo === "reservoir" && n.properties?._type === "tank"),
    pipes: edges.filter(e => !e.properties?._type || e.properties?._type === "pipe"),
    pumps: edges.filter(e => e.properties?._type === "pump"),
    valves: edges.filter(e => e.properties?._type === "valve"),
  };
}

// ════════════════════════════════════════
// QESG INPUT
// ════════════════════════════════════════

export interface QEsgInput {
  nodes: SpatialNode[];
  edges: SpatialEdge[];
  manholes: SpatialNode[];
  conduits: SpatialEdge[];
  outfalls: SpatialNode[];
}

export function getDataForQEsg(originFilter?: OriginModule): QEsgInput {
  const originLayers = getLayersByOrigin("qesg");
  const disciplineLayers = getLayersByDiscipline("esgoto");
  const merged = new Map<string, SpatialLayer>();
  for (const l of [...originLayers, ...disciplineLayers]) merged.set(l.id, l);
  let layers = Array.from(merged.values());
  if (originFilter) {
    layers = layers.filter(l => l.originModule === originFilter);
  }
  const relevantLayerIds = new Set(layers.map(l => l.id));

  const project = getSpatialProject();
  const nodes = Array.from(project.nodes.values()).filter(n => relevantLayerIds.has(n.layerId));
  const edges = Array.from(project.edges.values()).filter(e => relevantLayerIds.has(e.layerId));

  const manholeTypes = new Set<string>(["pv", "ci", "tl", "cr", "cp"]);

  return {
    nodes,
    edges,
    manholes: nodes.filter(n => manholeTypes.has(n.tipo)),
    conduits: edges,
    outfalls: nodes.filter(n => n.tipo === "outfall"),
  };
}
