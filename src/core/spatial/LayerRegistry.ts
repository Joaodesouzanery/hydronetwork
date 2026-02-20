/**
 * Layer Registry — Global registry of spatial layers shared across all modules.
 *
 * BEHAVIOR:
 * - Imported in Topografia → visible in Água
 * - Imported from IFC → visible in ALL modules
 * - "drawing" layers do NOT enter simulation
 */

import { CRSDefinition } from "./ProjectCRS";

export type LayerGeometryType = "Point" | "LineString" | "Polygon" | "Mixed";
export type LayerDiscipline = "topografia" | "esgoto" | "agua" | "drenagem" | "bim" | "generico" | "desenho";
export type LayerSource = "imported" | "created" | "calculated";

export interface LayerMetadata {
  modelType?: string;
  isDrawingOnly?: boolean;
  importedAt?: string;
  [key: string]: any;
}

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
  source: LayerSource;
  editable: boolean;
  nodeIds: string[];
  edgeIds: string[];
  metadata: LayerMetadata;
  createdAt: string;
}

let _layerCounter = 0;

export interface LayerRegistryStore {
  layers: Map<string, SpatialLayer>;
}

export function createLayerRegistryStore(): LayerRegistryStore {
  return { layers: new Map() };
}

export function createLayer(
  store: LayerRegistryStore,
  opts: Partial<SpatialLayer> & { name: string; discipline: LayerDiscipline; geometryType: LayerGeometryType }
): SpatialLayer {
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
    source: opts.source || "imported",
    editable: opts.editable ?? true,
    nodeIds: [],
    edgeIds: [],
    metadata: opts.metadata || {},
    createdAt: new Date().toISOString(),
  };
  store.layers.set(id, layer);
  return layer;
}

export function removeLayer(store: LayerRegistryStore, layerId: string): string[] {
  const layer = store.layers.get(layerId);
  if (!layer) return [];
  const removedNodeIds = [...layer.nodeIds];
  const removedEdgeIds = [...layer.edgeIds];
  store.layers.delete(layerId);
  return [...removedNodeIds, ...removedEdgeIds];
}

export function getLayersByDiscipline(store: LayerRegistryStore, discipline: LayerDiscipline): SpatialLayer[] {
  return Array.from(store.layers.values()).filter(l => l.discipline === discipline);
}

export function getAllLayers(store: LayerRegistryStore): SpatialLayer[] {
  return Array.from(store.layers.values());
}

export function getSimulationLayers(store: LayerRegistryStore): SpatialLayer[] {
  return Array.from(store.layers.values()).filter(
    l => l.discipline !== "desenho" && l.metadata?.isDrawingOnly !== true
  );
}

export function isSimulationLayer(layer: SpatialLayer): boolean {
  return layer.discipline !== "desenho" && layer.metadata?.isDrawingOnly !== true;
}
