/**
 * Results Store — Module-keyed store for dimensioning, simulation and profile results.
 *
 * Each module (QWater, QEsg, EPANET, SWMM, etc.) stores its results here,
 * alongside the spatial data in Spatial Core — never duplicated.
 */

import type { OriginModule } from "./LayerRegistry";

// ════════════════════════════════════════
// RESULT TYPES
// ════════════════════════════════════════

export type ResultsModule = "qwater" | "qesg" | "epanet" | "swmm" | "drenagem";

export interface ModuleResults {
  module: ResultsModule;
  timestamp: string;
  edgeResults: Map<string, Record<string, any>>;
  nodeResults: Map<string, Record<string, any>>;
  summary?: Record<string, any>;
}

export interface ProfilePoint {
  nodeId: string;
  distancia: number;
  cotaTerreno: number;
  cotaColetor?: number;
  cotaCoroa?: number;
  laminaDagua?: number;
  pressao?: number;
  diametro?: number;
  declividade?: number;
  profundidade?: number;
}

export interface SpatialProfile {
  id: string;
  originModule: OriginModule;
  points: ProfilePoint[];
  createdAt: string;
}

// ════════════════════════════════════════
// MODULE-LEVEL STORES
// ════════════════════════════════════════

const _resultsStore = new Map<ResultsModule, ModuleResults>();
const _profilesStore = new Map<string, SpatialProfile>();

// ── Results CRUD ──

export function setModuleResults(module: ResultsModule, results: Omit<ModuleResults, "module" | "timestamp">): ModuleResults {
  const full: ModuleResults = {
    module,
    timestamp: new Date().toISOString(),
    edgeResults: results.edgeResults,
    nodeResults: results.nodeResults,
    summary: results.summary,
  };
  _resultsStore.set(module, full);
  return full;
}

export function getModuleResults(module: ResultsModule): ModuleResults | null {
  return _resultsStore.get(module) ?? null;
}

export function getNodeResult(module: ResultsModule, nodeId: string): Record<string, any> | null {
  const results = _resultsStore.get(module);
  return results?.nodeResults.get(nodeId) ?? null;
}

export function getEdgeResult(module: ResultsModule, edgeId: string): Record<string, any> | null {
  const results = _resultsStore.get(module);
  return results?.edgeResults.get(edgeId) ?? null;
}

export function clearModuleResults(module?: ResultsModule): void {
  if (module) {
    _resultsStore.delete(module);
  } else {
    _resultsStore.clear();
  }
}

export function getAllResults(): Map<ResultsModule, ModuleResults> {
  return new Map(_resultsStore);
}

// ── Profiles CRUD ──

export function addProfile(profile: Omit<SpatialProfile, "createdAt">): SpatialProfile {
  const full: SpatialProfile = {
    ...profile,
    createdAt: new Date().toISOString(),
  };
  _profilesStore.set(profile.id, full);
  return full;
}

export function getProfile(id: string): SpatialProfile | null {
  return _profilesStore.get(id) ?? null;
}

export function getProfilesByOrigin(origin: OriginModule): SpatialProfile[] {
  return Array.from(_profilesStore.values()).filter(p => p.originModule === origin);
}

export function removeProfile(id: string): void {
  _profilesStore.delete(id);
}

export function clearProfiles(origin?: OriginModule): void {
  if (origin) {
    for (const [id, profile] of _profilesStore) {
      if (profile.originModule === origin) _profilesStore.delete(id);
    }
  } else {
    _profilesStore.clear();
  }
}

export function getAllProfiles(): SpatialProfile[] {
  return Array.from(_profilesStore.values());
}
