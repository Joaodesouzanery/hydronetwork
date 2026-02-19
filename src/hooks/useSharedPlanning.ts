/**
 * Shared planning state between Planning, OpenProject, and ProjectLibre modules.
 * Uses localStorage for persistence so data survives navigation.
 */
import { useState, useCallback, useEffect } from "react";

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
  lastUpdatedBy: string; // which module last saved
  lastUpdatedAt: string;
}

const STORAGE_KEY = "hydronetwork_shared_planning";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function loadFromStorage(): SharedPlanningData | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function saveToStorage(data: SharedPlanningData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useSharedPlanning(moduleName: string) {
  const [data, setData] = useState<SharedPlanningData>(() => {
    const saved = loadFromStorage();
    return saved || {
      projectName: "",
      manager: "",
      startDate: new Date().toISOString().split("T")[0],
      tasks: [],
      resources: [
        { name: "Encarregado", type: "mdo", qty: 1 },
        { name: "Pedreiro", type: "mdo", qty: 3 },
        { name: "Ajudante", type: "mdo", qty: 6 },
      ],
      lastUpdatedBy: moduleName,
      lastUpdatedAt: new Date().toISOString(),
    };
  });

  // Listen for changes from other modules (storage event fires in other tabs/windows)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setData(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Re-read from storage when the module is re-mounted (navigating between modules)
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) setData(saved);
  }, [moduleName]);

  const save = useCallback((updates: Partial<SharedPlanningData>) => {
    setData(prev => {
      const next = {
        ...prev,
        ...updates,
        lastUpdatedBy: moduleName,
        lastUpdatedAt: new Date().toISOString(),
      };
      saveToStorage(next);
      return next;
    });
  }, [moduleName]);

  const setTasks = useCallback((tasks: SharedTask[]) => save({ tasks }), [save]);
  const setResources = useCallback((resources: SharedResource[]) => save({ resources }), [save]);
  const setProjectName = useCallback((projectName: string) => save({ projectName }), [save]);
  const setManager = useCallback((manager: string) => save({ manager }), [save]);
  const setStartDate = useCallback((startDate: string) => save({ startDate }), [save]);

  return {
    ...data,
    setTasks,
    setResources,
    setProjectName,
    setManager,
    setStartDate,
    save,
    COLORS,
  };
}
