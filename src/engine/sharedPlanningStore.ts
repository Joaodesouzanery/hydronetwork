/**
 * Shared planning store using localStorage for data persistence
 * between Planning, OpenProject, and ProjectLibre modules.
 *
 * Now includes:
 * - Multi-project versioning (named projects)
 * - Supabase sync (cloud backup, cross-device)
 * - IndexedDB fallback (large datasets >5MB)
 */

import { supabase } from "@/lib/supabase";

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

/** Save async — writes to localStorage, IndexedDB, AND Supabase */
export async function saveHydroProjectAsync(
  data: HydroProjectSave,
  projectId?: string,
): Promise<void> {
  data.savedAt = new Date().toISOString();
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(PROJECT_SAVE_KEY, json);
  } catch { /* localStorage full */ }
  await idbPut(PROJECT_SAVE_KEY, data).catch(() => {});
  // Sync to Supabase (fire-and-forget)
  if (projectId) {
    syncProjectToSupabase(data, projectId).catch(() => {});
  }
}

// ══════════════════════════════════════
// Supabase sync (cloud persistence)
// ══════════════════════════════════════

async function getUserId(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch { return null; }
}

export async function syncProjectToSupabase(
  data: HydroProjectSave,
  projectId?: string,
): Promise<string> {
  const userId = await getUserId();
  const id = projectId || crypto.randomUUID();
  try {
    const { error } = await (supabase as any)
      .from("hydro_dimensioning_projects")
      .upsert({
        id,
        user_id: userId || undefined,
        nome: data.projectName || "HydroNetwork",
        project_data: {
          pontos: data.pontos,
          trechos: data.trechos,
          rdos: data.rdos,
          planning: data.planning,
          scheduleResult: data.scheduleResult,
          savedAt: data.savedAt,
        },
      }, { onConflict: "id" });
    if (error) throw error;
  } catch (err) {
    console.error("[HydroSync] Supabase upsert failed:", err);
  }
  return id;
}

export async function loadProjectFromSupabase(
  projectId?: string,
): Promise<{ id: string; data: HydroProjectSave } | null> {
  try {
    const userId = await getUserId();
    let query = (supabase as any)
      .from("hydro_dimensioning_projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    if (projectId) query = query.eq("id", projectId);
    query = query.limit(1);
    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) {
      const row = data[0];
      const pd = row.project_data || {};
      return {
        id: row.id,
        data: {
          pontos: pd.pontos || [],
          trechos: pd.trechos || [],
          rdos: pd.rdos || [],
          planning: pd.planning || null,
          scheduleResult: pd.scheduleResult || null,
          savedAt: pd.savedAt || row.updated_at,
          projectName: row.nome,
        },
      };
    }
  } catch { /* fallback to local */ }
  return null;
}

export interface ProjectListItem {
  id: string;
  nome: string;
  updatedAt: string;
  pontosCount: number;
  trechosCount: number;
}

export async function listSupabaseProjects(): Promise<ProjectListItem[]> {
  try {
    const userId = await getUserId();
    let query = (supabase as any)
      .from("hydro_dimensioning_projects")
      .select("id, nome, updated_at, project_data")
      .order("updated_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      nome: r.nome || "Sem nome",
      updatedAt: r.updated_at,
      pontosCount: r.project_data?.pontos?.length || 0,
      trechosCount: r.project_data?.trechos?.length || 0,
    }));
  } catch { return []; }
}

export async function deleteProjectFromSupabase(projectId: string): Promise<void> {
  try {
    const userId = await getUserId();
    let query = (supabase as any).from("hydro_dimensioning_projects").delete().eq("id", projectId);
    if (userId) query = query.eq("user_id", userId);
    await query;
  } catch (err) {
    console.error("[HydroSync] Delete failed:", err);
  }
}

// ══════════════════════════════════════
// Multi-project local index
// ══════════════════════════════════════

const PROJECTS_INDEX_KEY = "hydronetwork_projects_index";

interface LocalProjectIndex {
  projects: Array<{ id: string; nome: string; updatedAt: string; pontosCount: number; trechosCount: number }>;
}

export function getLocalProjectIndex(): LocalProjectIndex {
  try {
    const data = localStorage.getItem(PROJECTS_INDEX_KEY);
    return data ? JSON.parse(data) : { projects: [] };
  } catch { return { projects: [] }; }
}

function saveLocalProjectIndex(index: LocalProjectIndex): void {
  try { localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(index)); } catch {}
}

export async function saveProjectAs(
  name: string,
  data: HydroProjectSave,
): Promise<string> {
  const id = crypto.randomUUID();
  data.projectName = name;
  data.savedAt = new Date().toISOString();

  // Save to localStorage as current project
  saveHydroProject(data);

  // Update local index
  const index = getLocalProjectIndex();
  index.projects = index.projects.filter(p => p.id !== id);
  index.projects.unshift({
    id, nome: name, updatedAt: data.savedAt,
    pontosCount: data.pontos.length, trechosCount: data.trechos.length,
  });
  saveLocalProjectIndex(index);

  // Sync to Supabase
  await syncProjectToSupabase(data, id).catch(() => {});
  return id;
}

export async function deleteProject(projectId: string): Promise<void> {
  // Remove from local index
  const index = getLocalProjectIndex();
  index.projects = index.projects.filter(p => p.id !== projectId);
  saveLocalProjectIndex(index);
  // Remove from Supabase
  await deleteProjectFromSupabase(projectId).catch(() => {});
}

export async function listAllProjects(): Promise<ProjectListItem[]> {
  // Merge local + Supabase lists
  const local = getLocalProjectIndex().projects;
  const remote = await listSupabaseProjects().catch(() => [] as ProjectListItem[]);
  const merged = new Map<string, ProjectListItem>();
  for (const p of local) merged.set(p.id, p);
  for (const p of remote) {
    if (!merged.has(p.id) || new Date(p.updatedAt) > new Date(merged.get(p.id)!.updatedAt)) {
      merged.set(p.id, p);
    }
  }
  return Array.from(merged.values()).sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
