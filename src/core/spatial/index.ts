/**
 * Spatial module — re-exports all spatial types and functions.
 * SpatialCore re-exports the project-aware versions of layer operations.
 */
export * from "./ProjectCRS";
export { 
  type LayerGeometryType, type LayerDiscipline, type LayerSource,
  type LayerMetadata, type SpatialLayer, type LayerRegistryStore,
  createLayerRegistryStore, isSimulationLayer,
} from "./LayerRegistry";
export * from "./SpatialCore";
