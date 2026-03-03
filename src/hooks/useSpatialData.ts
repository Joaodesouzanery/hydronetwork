/**
 * useSpatialData — React hook that encapsulates reading/writing to the Spatial Core
 * for any module.
 *
 * Uses a module-level version counter to trigger re-renders when spatial data
 * changes, avoiding the need for a full context/provider setup.
 */

import { useState, useMemo, useCallback } from "react";
import {
  getSpatialProject, getAllNodes, getAllEdges,
  getNodesByOrigin, getEdgesByOrigin,
  addNode, addEdge, removeNode, removeEdge,
  nodesToLegacyPoints, edgesToLegacyTrechos,
  createLayer, getLayersByOrigin, getLayersByDiscipline,
  type SpatialNode, type SpatialEdge, type SpatialProject,
  type OriginModule, type LayerDiscipline, type LayerGeometryType,
} from "@/core/spatial";
import type { PontoTopografico } from "@/engine/reader";
import type { Trecho } from "@/engine/domain";

// ── Module-level version counter ──

let _spatialVersion = 0;

/** Bump the global spatial version counter, causing all useSpatialData hooks to re-render. */
export function bumpSpatialVersion(): void {
  _spatialVersion++;
}

// ── Hook ──

export function useSpatialData(originModule: OriginModule) {
  const [version, setVersion] = useState(_spatialVersion);

  const refresh = useCallback(() => {
    _spatialVersion++;
    setVersion(_spatialVersion);
  }, []);

  // ── Derived data (recalculated when version changes) ──

  const project = useMemo<SpatialProject>(
    () => getSpatialProject(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const nodes = useMemo<SpatialNode[]>(
    () => getNodesByOrigin(originModule),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [originModule, version],
  );

  const edges = useMemo<SpatialEdge[]>(
    () => getEdgesByOrigin(originModule),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [originModule, version],
  );

  const legacyPontos = useMemo<PontoTopografico[]>(
    () => nodesToLegacyPoints(nodes),
    [nodes],
  );

  const legacyTrechos = useMemo<Trecho[]>(
    () => edgesToLegacyTrechos(edges, getSpatialProject().nodes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edges, version],
  );

  // ── Mutations ──

  const addNodeToSpatial = useCallback(
    (node: Omit<SpatialNode, "properties" | "origin_module"> & { properties?: Record<string, any> }) => {
      addNode({ ...node, origin_module: originModule });
      refresh();
    },
    [originModule, refresh],
  );

  const addEdgeToSpatial = useCallback(
    (edge: Omit<SpatialEdge, "properties" | "comprimento" | "declividade" | "origin_module"> & {
      properties?: Record<string, any>;
      comprimento?: number;
      declividade?: number;
    }) => {
      addEdge({ ...edge, origin_module: originModule });
      refresh();
    },
    [originModule, refresh],
  );

  const removeNodeFromSpatial = useCallback(
    (id: string) => {
      removeNode(id);
      refresh();
    },
    [refresh],
  );

  const removeEdgeFromSpatial = useCallback(
    (id: string) => {
      removeEdge(id);
      refresh();
    },
    [refresh],
  );

  // ── Import from topography ──

  const importFromTopography = useCallback(() => {
    const topoNodes = getNodesByOrigin("topografia");
    const topoEdges = getEdgesByOrigin("topografia");

    // Copy nodes with the new origin module
    for (const node of topoNodes) {
      const newId = `${originModule}_${node.id}`;
      addNode({
        ...node,
        id: newId,
        origin_module: originModule,
      });
    }

    // Build a mapping from old node IDs to new node IDs
    const idMap = new Map<string, string>();
    for (const node of topoNodes) {
      idMap.set(node.id, `${originModule}_${node.id}`);
    }

    // Copy edges with the new origin module, remapping node references
    for (const edge of topoEdges) {
      addEdge({
        ...edge,
        id: `${originModule}_${edge.id}`,
        startNodeId: idMap.get(edge.startNodeId) ?? edge.startNodeId,
        endNodeId: idMap.get(edge.endNodeId) ?? edge.endNodeId,
        origin_module: originModule,
      });
    }

    refresh();
  }, [originModule, refresh]);

  // ── Layer management ──

  const ensureLayer = useCallback(
    (name: string, discipline: LayerDiscipline, geometryType: LayerGeometryType) => {
      const existing = getLayersByOrigin(originModule);
      const found = existing.find(
        (l) => l.name === name && l.discipline === discipline && l.geometryType === geometryType,
      );
      if (found) return found;

      const layer = createLayer({
        name,
        discipline,
        geometryType,
        originModule,
        source: "created",
      });
      refresh();
      return layer;
    },
    [originModule, refresh],
  );

  return {
    nodes,
    edges,
    legacyPontos,
    legacyTrechos,
    addNodeToSpatial,
    addEdgeToSpatial,
    removeNodeFromSpatial,
    removeEdgeFromSpatial,
    importFromTopography,
    ensureLayer,
    refresh,
    project,
  };
}
