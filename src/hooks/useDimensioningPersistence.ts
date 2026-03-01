/**
 * useDimensioningPersistence — Auto-save/load hook for QEsg/QWater dimensioning state.
 *
 * Persists to localStorage (fast) + Supabase (cloud backup) via sharedPlanningStore.
 * Debounced auto-save (2s) on state change, load-on-mount from last saved state.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  loadHydroProjectAsync,
  saveHydroProjectAsync,
  loadProjectFromSupabase,
  type HydroProjectSave,
  type SewerDimensioningState,
  type WaterDimensioningState,
} from "@/engine/sharedPlanningStore";

export type PersistenceStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 2000;
const DIMENSIONING_PROJECT_KEY = "hydronetwork_dimensioning_project_id";

function getStoredProjectId(): string {
  try {
    return localStorage.getItem(DIMENSIONING_PROJECT_KEY) || "";
  } catch { return ""; }
}

function setStoredProjectId(id: string): void {
  try { localStorage.setItem(DIMENSIONING_PROJECT_KEY, id); } catch {}
}

export function useDimensioningPersistence(moduleKey: "sewer" | "water") {
  const [status, setStatus] = useState<PersistenceStatus>("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectIdRef = useRef<string>(getStoredProjectId());
  const loadedRef = useRef(false);

  const save = useCallback(async (state: SewerDimensioningState | WaterDimensioningState) => {
    // Cancel pending save
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        // Load existing project data to merge
        const existing = await loadHydroProjectAsync();
        const merged: HydroProjectSave = {
          pontos: existing?.pontos || [],
          trechos: existing?.trechos || [],
          rdos: existing?.rdos || [],
          planning: existing?.planning || null,
          scheduleResult: existing?.scheduleResult || null,
          savedAt: new Date().toISOString(),
          projectName: existing?.projectName || "HydroNetwork",
          sewerState: existing?.sewerState,
          waterState: existing?.waterState,
        };

        // Update the specific module state
        if (moduleKey === "sewer") {
          merged.sewerState = state as SewerDimensioningState;
        } else {
          merged.waterState = state as WaterDimensioningState;
        }

        // Generate project ID if needed
        if (!projectIdRef.current) {
          projectIdRef.current = crypto.randomUUID();
          setStoredProjectId(projectIdRef.current);
        }

        await saveHydroProjectAsync(merged, projectIdRef.current);
        const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        setLastSaved(now);
        setStatus("saved");
      } catch (err) {
        console.error(`[DimensioningPersistence] Save ${moduleKey} failed:`, err);
        setStatus("error");
      }
    }, DEBOUNCE_MS);
  }, [moduleKey]);

  const load = useCallback(async (): Promise<SewerDimensioningState | WaterDimensioningState | null> => {
    if (loadedRef.current) return null;
    loadedRef.current = true;

    try {
      // Try local first (fast)
      const local = await loadHydroProjectAsync();
      const localState = moduleKey === "sewer" ? local?.sewerState : local?.waterState;
      if (localState) return localState;

      // Fallback to Supabase
      const remote = await loadProjectFromSupabase(projectIdRef.current || undefined);
      if (remote) {
        projectIdRef.current = remote.id;
        setStoredProjectId(remote.id);
        const remoteState = moduleKey === "sewer"
          ? remote.data.sewerState
          : remote.data.waterState;
        return remoteState || null;
      }
    } catch (err) {
      console.error(`[DimensioningPersistence] Load ${moduleKey} failed:`, err);
    }
    return null;
  }, [moduleKey]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { save, load, status, lastSaved };
}
