/**
 * Shared planning store using localStorage for data persistence
 * between Planning, OpenProject, and ProjectLibre modules.
 */

export interface SharedTask {
  id: string;
  name: string;
  duration: number;
  start: string;
  resource: string;
  predecessors: string;
  progress: number;
  color: string;
}

export interface SharedResource {
  name: string;
  type: string;
  qty: number;
}

export interface SharedPlanningData {
  projectName: string;
  manager: string;
  startDate: string;
  tasks: SharedTask[];
  resources: SharedResource[];
  updatedAt: string;
  updatedBy: string; // "planning" | "openproject" | "projectlibre"
}

const STORAGE_KEY = "hydronetwork_shared_planning";

export function loadSharedPlanning(): SharedPlanningData | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveSharedPlanning(data: SharedPlanningData): void {
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearSharedPlanning(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Full project save (all hydro data)
export interface HydroProjectSave {
  pontos: any[];
  trechos: any[];
  rdos: any[];
  planning: SharedPlanningData | null;
  scheduleResult: any;
  savedAt: string;
  projectName: string;
}

const PROJECT_SAVE_KEY = "hydronetwork_project_save";

export function saveHydroProject(data: HydroProjectSave): void {
  data.savedAt = new Date().toISOString();
  localStorage.setItem(PROJECT_SAVE_KEY, JSON.stringify(data));
}

export function loadHydroProject(): HydroProjectSave | null {
  try {
    const data = localStorage.getItem(PROJECT_SAVE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}
