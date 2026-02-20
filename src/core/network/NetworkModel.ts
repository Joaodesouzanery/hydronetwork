/**
 * Network Model — Type definitions for the hydraulic network.
 * These extend SpatialNode/SpatialEdge with network-specific semantics.
 */

import { SpatialNode, SpatialEdge, NodeType } from "@/core/spatial";

/** Network-aware node with computed hydraulic properties */
export interface NetworkNode extends SpatialNode {
  groundElevation: number;      // = z (cota terreno)
  invertElevation: number;      // = cotaFundo
  depth: number;                // = z - cotaFundo
  connectedEdgeIds: string[];
}

/** Network-aware edge with typed classification */
export interface NetworkEdge extends SpatialEdge {
  type: "pipe" | "pump" | "valve" | "conduit";
  geometry: { coordinates: [number, number, number][] };
}

/** Drawing layer — NEVER enters simulation */
export interface DrawingLayer {
  id: string;
  name: string;
  features: Array<{
    id: string;
    type: "point" | "line" | "polygon";
    coordinates: number[][];
    properties: Record<string, any>;
  }>;
}

/** Convert SpatialNode to NetworkNode */
export function toNetworkNode(node: SpatialNode, connectedEdgeIds: string[]): NetworkNode {
  return {
    ...node,
    groundElevation: node.z,
    invertElevation: node.cotaFundo ?? node.z,
    depth: node.profundidade ?? (node.cotaFundo ? node.z - node.cotaFundo : 0),
    connectedEdgeIds,
  };
}

/** Convert SpatialEdge to NetworkEdge */
export function toNetworkEdge(edge: SpatialEdge): NetworkEdge {
  const type = edge.properties?._type === "pump" ? "pump"
    : edge.properties?._type === "valve" ? "valve"
    : edge.tipoRede.includes("Esgoto") || edge.tipoRede.includes("Drenagem") ? "conduit"
    : "pipe";

  return {
    ...edge,
    type,
    geometry: {
      coordinates: edge.vertices || [],
    },
  };
}

/** Network summary statistics */
export interface NetworkSummaryStats {
  totalNodes: number;
  totalEdges: number;
  totalLength: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  disconnectedNodes: number;
  maxDepth: number;
  minElevation: number;
  maxElevation: number;
}

export function computeNetworkStats(
  nodes: SpatialNode[],
  edges: SpatialEdge[]
): NetworkSummaryStats {
  const connectedNodeIds = new Set<string>();
  const nodesByType: Record<string, number> = {};
  const edgesByType: Record<string, number> = {};
  let totalLength = 0;
  let maxDepth = 0;
  let minElevation = Infinity;
  let maxElevation = -Infinity;

  for (const e of edges) {
    connectedNodeIds.add(e.startNodeId);
    connectedNodeIds.add(e.endNodeId);
    totalLength += e.comprimento;
    const t = e.tipoRede || "Genérico";
    edgesByType[t] = (edgesByType[t] || 0) + 1;
  }

  for (const n of nodes) {
    nodesByType[n.tipo] = (nodesByType[n.tipo] || 0) + 1;
    if (n.profundidade && n.profundidade > maxDepth) maxDepth = n.profundidade;
    if (n.z < minElevation) minElevation = n.z;
    if (n.z > maxElevation) maxElevation = n.z;
  }

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalLength: Math.round(totalLength * 100) / 100,
    nodesByType,
    edgesByType,
    disconnectedNodes: nodes.filter(n => !connectedNodeIds.has(n.id)).length,
    maxDepth,
    minElevation: minElevation === Infinity ? 0 : minElevation,
    maxElevation: maxElevation === -Infinity ? 0 : maxElevation,
  };
}
