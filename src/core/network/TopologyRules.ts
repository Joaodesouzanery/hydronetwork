/**
 * Topology Rules — QGIS-like topology behaviors.
 * Automatically enforced when editing the network.
 */

import {
  getSpatialProject, getConnectedEdges, removeEdge, removeNode,
  recalculateEdge, addNode, SpatialNode, SpatialEdge, NodeType,
} from "@/core/spatial";

export type NodeDeleteAction = "deleteConnectedEdges" | "reconnectAutomatically" | "cancel";
export type EdgeDeleteAction = "deleteEdge" | "preserveNodes" | "cancel";

export interface TopologyDeleteResult {
  needsConfirmation: boolean;
  connectedEdgeCount: number;
  message: string;
  options: NodeDeleteAction[];
}

/** Check what happens when deleting a node — returns confirmation info */
export function previewNodeDelete(nodeId: string): TopologyDeleteResult {
  const connectedEdges = getConnectedEdges(nodeId);

  if (connectedEdges.length === 0) {
    return {
      needsConfirmation: false,
      connectedEdgeCount: 0,
      message: "Nó isolado — pode ser excluído sem impacto.",
      options: ["deleteConnectedEdges"],
    };
  }

  return {
    needsConfirmation: true,
    connectedEdgeCount: connectedEdges.length,
    message: `Este nó está conectado a ${connectedEdges.length} trecho(s).`,
    options: ["deleteConnectedEdges", "reconnectAutomatically", "cancel"],
  };
}

/** Execute node deletion with chosen action */
export function executeNodeDelete(nodeId: string, action: NodeDeleteAction): boolean {
  if (action === "cancel") return false;

  const project = getSpatialProject();
  const node = project.nodes.get(nodeId);
  if (!node) return false;

  if (action === "deleteConnectedEdges") {
    removeNode(nodeId, { removeConnectedEdges: true });
    return true;
  }

  if (action === "reconnectAutomatically") {
    const connected = getConnectedEdges(nodeId);
    // Find pairs of edges that can be reconnected
    if (connected.length === 2) {
      const [e1, e2] = connected;
      const otherNode1 = e1.startNodeId === nodeId ? e1.endNodeId : e1.startNodeId;
      const otherNode2 = e2.startNodeId === nodeId ? e2.endNodeId : e2.startNodeId;

      // Remove old edges and node
      removeEdge(e1.id);
      removeEdge(e2.id);
      removeNode(nodeId, { removeConnectedEdges: false });

      // Create new edge connecting the two remaining nodes
      const { addEdge } = require("@/core/spatial");
      addEdge({
        id: `reconnected_${e1.id}_${e2.id}`,
        startNodeId: otherNode1,
        endNodeId: otherNode2,
        dn: e1.dn || e2.dn,
        material: e1.material || e2.material,
        tipoRede: e1.tipoRede || e2.tipoRede,
        layerId: e1.layerId,
      });
      return true;
    }

    // More than 2 edges — just delete connected
    removeNode(nodeId, { removeConnectedEdges: true });
    return true;
  }

  return false;
}

/** Move node and automatically update all connected edges */
export function moveNodeWithTopology(nodeId: string, newX: number, newY: number, newZ?: number) {
  const project = getSpatialProject();
  const node = project.nodes.get(nodeId);
  if (!node) return;

  node.x = newX;
  node.y = newY;
  if (newZ !== undefined) node.z = newZ;

  // Update all connected edge geometries
  const connected = getConnectedEdges(nodeId);
  for (const edge of connected) {
    // Update vertex coordinates in the edge geometry
    if (edge.vertices && edge.vertices.length >= 2) {
      if (edge.startNodeId === nodeId) {
        edge.vertices[0] = [newX, newY, newZ ?? node.z];
      }
      if (edge.endNodeId === nodeId) {
        edge.vertices[edge.vertices.length - 1] = [newX, newY, newZ ?? node.z];
      }
    }
    recalculateEdge(edge.id);
  }
}

/** Move an intermediate vertex on an edge → recalculate length */
export function moveEdgeVertex(edgeId: string, vertexIndex: number, newX: number, newY: number, newZ?: number) {
  const project = getSpatialProject();
  const edge = project.edges.get(edgeId);
  if (!edge || !edge.vertices || vertexIndex < 0 || vertexIndex >= edge.vertices.length) return;

  edge.vertices[vertexIndex] = [newX, newY, newZ ?? edge.vertices[vertexIndex][2]];
  recalculateEdge(edgeId);
}

/** Insert a new vertex on an edge at a given index */
export function insertEdgeVertex(edgeId: string, afterIndex: number, x: number, y: number, z: number) {
  const project = getSpatialProject();
  const edge = project.edges.get(edgeId);
  if (!edge || !edge.vertices) return;

  edge.vertices.splice(afterIndex + 1, 0, [x, y, z]);
  recalculateEdge(edgeId);
}

/** Delete a vertex from an edge (min 2 vertices required) */
export function deleteEdgeVertex(edgeId: string, vertexIndex: number) {
  const project = getSpatialProject();
  const edge = project.edges.get(edgeId);
  if (!edge || !edge.vertices || edge.vertices.length <= 2) return;

  edge.vertices.splice(vertexIndex, 1);
  recalculateEdge(edgeId);
}

/** Auto-create nodes when importing edges without nodes (topology rule) */
export function ensureEdgeEndpointsHaveNodes(edgeId: string): { created: string[] } {
  const project = getSpatialProject();
  const edge = project.edges.get(edgeId);
  if (!edge) return { created: [] };

  const created: string[] = [];

  if (!project.nodes.has(edge.startNodeId) && edge.vertices && edge.vertices.length >= 1) {
    const [x, y, z] = edge.vertices[0];
    addNode({
      id: edge.startNodeId,
      x, y, z,
      tipo: "junction",
      layerId: edge.layerId,
    });
    created.push(edge.startNodeId);
  }

  if (!project.nodes.has(edge.endNodeId) && edge.vertices && edge.vertices.length >= 2) {
    const v = edge.vertices[edge.vertices.length - 1];
    addNode({
      id: edge.endNodeId,
      x: v[0], y: v[1], z: v[2],
      tipo: "junction",
      layerId: edge.layerId,
    });
    created.push(edge.endNodeId);
  }

  return { created };
}
