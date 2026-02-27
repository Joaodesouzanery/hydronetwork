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
const IDB_DB_NAME = "hydronetwork_db";
const IDB_STORE_NAME = "project_data";
const IDB_VERSION = 1;

// ══════════════════════════════════════
// IndexedDB helpers (fallback for large data)
// ══════════════════════════════════════

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: any): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    tx.objectStore(IDB_STORE_NAME).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGet(key: string): Promise<any> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const req = tx.objectStore(IDB_STORE_NAME).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ══════════════════════════════════════
// Save: try localStorage first, fallback to IndexedDB
// ══════════════════════════════════════

export function saveHydroProject(data: HydroProjectSave): void {
  data.savedAt = new Date().toISOString();
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(PROJECT_SAVE_KEY, json);
  } catch {
    // localStorage full (>5MB) — use IndexedDB
    localStorage.removeItem(PROJECT_SAVE_KEY);
    idbPut(PROJECT_SAVE_KEY, data).catch(() => {});
  }
}

export function loadHydroProject(): HydroProjectSave | null {
  try {
    const data = localStorage.getItem(PROJECT_SAVE_KEY);
    if (data) return JSON.parse(data);
  } catch { /* fall through */ }
  return null;
}

/** Async load — tries localStorage first, then IndexedDB */
export async function loadHydroProjectAsync(): Promise<HydroProjectSave | null> {
  // Try localStorage first (fast, sync)
  const sync = loadHydroProject();
  if (sync) return sync;
  // Fallback to IndexedDB (for large projects)
  try {
    const data = await idbGet(PROJECT_SAVE_KEY);
    return data ?? null;
  } catch {
    return null;
  }
}

/** Save async — always writes to IndexedDB as backup */
export async function saveHydroProjectAsync(data: HydroProjectSave): Promise<void> {
  data.savedAt = new Date().toISOString();
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(PROJECT_SAVE_KEY, json);
  } catch { /* localStorage full */ }
  // Always write to IndexedDB as durable backup
  await idbPut(PROJECT_SAVE_KEY, data).catch(() => {});
}
