/**
 * Core module — main barrel export for the entire src/core architecture.
 *
 * Structure:
 * - spatial/    → ProjectCRS, LayerRegistry, SpatialCore
 * - network/    → NetworkModel, TopologyRules
 * - import/     → NumericParser, GeometryProcessor
 * - validation/ → ImportValidator
 * - sync/       → ModuleSync
 * - editing/    → EditBehaviors
 */
export * from "./spatial";
export * from "./network";
export * from "./import";
export * from "./validation/ImportValidator";
export * from "./sync/ModuleSync";
export * from "./editing/EditBehaviors";
