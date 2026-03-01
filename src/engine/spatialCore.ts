/**
 * Spatial Core — Re-exports from src/core/spatial for backward compatibility.
 * All canonical logic now lives in src/core/spatial/.
 */

// Re-export everything from the new canonical location
export {
  // CRS
  type CRSDefinition, CRS_CATALOG, detectCRSFromCoordinates, getDefaultCRS, findCRS,
  type ProjectSettings,
  // Layer
  type LayerGeometryType, type LayerDiscipline, type LayerSource,
  type LayerMetadata, type SpatialLayer, type LayerRegistryStore,
  type OriginModule,
  createLayerRegistryStore, isSimulationLayer,
  // SpatialCore
  type NodeType, type SpatialNode, type SpatialEdge,
  type SpatialProject, type SerializedSpatialProject,
  getSpatialProject, resetSpatialProject, setProjectCRS,
  createLayer, removeLayer, getLayersByDiscipline, getAllLayers, getLayersByOrigin,
  addNode, removeNode, moveNode, getNode, getAllNodes, getNodesByLayer, getNodesByOrigin,
  addEdge, removeEdge, recalculateEdge, getConnectedEdges, getAllEdges, getEdgesByLayer, getEdgesByOrigin,
  importEdgeWithAutoNodes,
  getSimulationNodes, getSimulationEdges,
  serializeProject, deserializeProject,
  legacyPointsToNodes, legacyTrechosToEdges, nodesToLegacyPoints, edgesToLegacyTrechos,
  // Results & Profiles
  type ResultsModule, type ModuleResults, type ProfilePoint, type SpatialProfile,
  setModuleResults, getModuleResults, getNodeResult, getEdgeResult,
  clearModuleResults, getAllResults,
  addProfile, getProfile, getProfilesByOrigin, removeProfile, clearProfiles, getAllProfiles,
} from "@/core/spatial";

// Also re-export validation from core
export { validateProject, type ValidationIssue } from "@/core/validation/ImportValidator";
