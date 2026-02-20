/**
 * GeometryProcessor — Converts linear geometries into topology (nodes + edges).
 *
 * RULE: Trecho gera nó. Não nó gera trecho.
 * When importing lines, nodes are auto-created at endpoints with tolerance-based deduplication.
 */

import { NodeType } from "@/core/spatial";

export interface ProcessedNode {
  id: string;
  x: number;
  y: number;
  z: number;
  tipo: NodeType;
  properties: Record<string, any>;
}

export interface ProcessedEdge {
  id: string;
  startNodeId: string;
  endNodeId: string;
  dn: number;
  material: string;
  tipoRede: string;
  roughness?: number;
  vertices?: [number, number, number][];
  properties: Record<string, any>;
}

export interface GeometryProcessorResult {
  nodes: ProcessedNode[];
  edges: ProcessedEdge[];
}

/**
 * Find an existing node within tolerance or create a new one.
 */
export function findOrCreateNode(
  nodeIndex: Map<string, string>,
  nodes: ProcessedNode[],
  x: number,
  y: number,
  z: number,
  tolerance: number,
  prefix: string,
  counter: { value: number },
  extraProps?: Record<string, any>
): string {
  const key = `${x.toFixed(tolerance >= 1 ? 1 : Math.max(0, Math.ceil(-Math.log10(tolerance))))}` +
    `,${y.toFixed(tolerance >= 1 ? 1 : Math.max(0, Math.ceil(-Math.log10(tolerance))))}`;

  if (nodeIndex.has(key)) return nodeIndex.get(key)!;

  const id = `${prefix}N${++counter.value}`;
  nodeIndex.set(key, id);
  nodes.push({
    id, x, y, z,
    tipo: "junction",
    properties: extraProps || {},
  });
  return id;
}

/**
 * Process linear geometries (LineStrings) into nodes and edges.
 * Auto-creates nodes at first/last vertices with tolerance-based deduplication.
 */
export function processLinearGeometries(
  lines: Array<{
    coordinates: number[][];
    properties?: Record<string, any>;
    id?: string;
  }>,
  options: {
    tolerance?: number;
    defaultDn?: number;
    defaultMaterial?: string;
    prefix?: string;
    source?: string;
  } = {}
): GeometryProcessorResult {
  const {
    tolerance = 0.01,
    defaultDn = 200,
    defaultMaterial = "PVC",
    prefix = "GEO_",
    source = "Geometry",
  } = options;

  const nodes: ProcessedNode[] = [];
  const edges: ProcessedEdge[] = [];
  const nodeIndex = new Map<string, string>();
  const nodeCounter = { value: 0 };
  const edgeCounter = { value: 0 };

  const snapDecimals = Math.max(0, Math.ceil(-Math.log10(tolerance)));

  function getOrCreate(x: number, y: number, z: number, extraProps?: Record<string, any>): string {
    const key = `${x.toFixed(snapDecimals)},${y.toFixed(snapDecimals)}`;
    if (nodeIndex.has(key)) return nodeIndex.get(key)!;
    const id = `${prefix}N${++nodeCounter.value}`;
    nodeIndex.set(key, id);
    nodes.push({ id, x, y, z, tipo: "junction", properties: { _source: source, ...extraProps } });
    return id;
  }

  for (const line of lines) {
    if (line.coordinates.length < 2) continue;

    const first = line.coordinates[0];
    const last = line.coordinates[line.coordinates.length - 1];

    const startId = getOrCreate(first[0], first[1], first[2] || 0);
    const endId = getOrCreate(last[0], last[1], last[2] || 0);

    const vertices: [number, number, number][] = line.coordinates.map(
      c => [c[0], c[1], c[2] || 0] as [number, number, number]
    );

    edges.push({
      id: line.id || `${prefix}E${++edgeCounter.value}`,
      startNodeId: startId,
      endNodeId: endId,
      dn: line.properties?.diameter || line.properties?.dn || defaultDn,
      material: line.properties?.material || defaultMaterial,
      tipoRede: line.properties?.tipoRede || "Genérico",
      roughness: line.properties?.roughness,
      vertices,
      properties: { _source: source, ...line.properties },
    });
  }

  return { nodes, edges };
}
