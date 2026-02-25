/**
 * Project ZIP Export/Import engine.
 * Exports all platform data as a structured ZIP file and imports it back.
 * Covers: plans, RDOs, topography, BDI contracts, equipment, settings.
 */

import JSZip from "jszip";
import { saveAs } from "file-saver";
import { getSavedPlans, savePlan, type SavedPlan } from "./savedPlanning";
import { loadRDOs, saveRDOs, type RDO } from "./rdo";
import type { PontoTopografico } from "./reader";
import type { Trecho } from "./domain";

// ── Manifest ──

export interface ProjectManifest {
  version: number;
  exportedAt: string;
  platform: "HydroNetwork";
  modules: string[];
  counts: Record<string, number>;
}

// ── localStorage key registry ──

const LOCAL_STORAGE_KEYS: Record<string, string> = {
  plans: "hydronetwork_saved_plans",
  rdos: "rdoData",
  topographySnapshot: "hydroImportSnapshot",
  importHistory: "hydroImportHistory",
  importTemplates: "hydroImportTemplates",
  bdiContracts: "contratos_bdi",
  pointTypes: "point_types",
  equipment: "hydro_rdos_equipment",
  trechos: "hydronetwork_trechos",
};

// ── Export ──

export async function exportProjectAsZip(projectName?: string): Promise<void> {
  const zip = new JSZip();
  const modules: string[] = [];
  const counts: Record<string, number> = {};

  // 1. Saved Plans
  const plans = getSavedPlans();
  if (plans.length > 0) {
    zip.file("plans.json", JSON.stringify(plans, null, 2));
    modules.push("plans");
    counts.plans = plans.length;
  }

  // 2. RDOs
  const rdos = loadRDOs();
  if (rdos.length > 0) {
    zip.file("rdos.json", JSON.stringify(rdos, null, 2));
    modules.push("rdos");
    counts.rdos = rdos.length;
  }

  // 3. Topography Snapshot (pontos + trechos)
  const snapshotRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.topographySnapshot);
  if (snapshotRaw) {
    zip.file("topography.json", snapshotRaw);
    modules.push("topography");
    try {
      const snap = JSON.parse(snapshotRaw);
      counts.pontos = snap.pontos?.length || 0;
      counts.trechos = snap.trechos?.length || 0;
    } catch { /* ignore */ }
  }

  // 4. BDI Contracts
  const bdiRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.bdiContracts);
  if (bdiRaw && bdiRaw !== "[]") {
    zip.file("bdi_contracts.json", bdiRaw);
    modules.push("bdi");
    try { counts.bdiContracts = JSON.parse(bdiRaw).length; } catch { /* ignore */ }
  }

  // 5. Equipment
  const equipRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.equipment);
  if (equipRaw && equipRaw !== "[]") {
    zip.file("equipment.json", equipRaw);
    modules.push("equipment");
    try { counts.equipment = JSON.parse(equipRaw).length; } catch { /* ignore */ }
  }

  // 6. Point Types
  const ptRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.pointTypes);
  if (ptRaw) {
    zip.file("point_types.json", ptRaw);
    modules.push("pointTypes");
  }

  // 7. Import Templates
  const templRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.importTemplates);
  if (templRaw && templRaw !== "[]") {
    zip.file("import_templates.json", templRaw);
    modules.push("importTemplates");
  }

  // 8. Import History
  const histRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.importHistory);
  if (histRaw && histRaw !== "[]") {
    zip.file("import_history.json", histRaw);
    modules.push("importHistory");
  }

  // 9. Trechos (standalone from TopographyMap)
  const trechosRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.trechos);
  if (trechosRaw && trechosRaw !== "[]") {
    zip.file("trechos.json", trechosRaw);
    if (!modules.includes("topography")) modules.push("trechos");
    try { counts.trechosStandalone = JSON.parse(trechosRaw).length; } catch { /* ignore */ }
  }

  // Manifest
  const manifest: ProjectManifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    platform: "HydroNetwork",
    modules,
    counts,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Generate and download
  const name = projectName || "HydroNetwork_Projeto";
  const dateStr = new Date().toISOString().split("T")[0];
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  saveAs(blob, `${name}_${dateStr}.zip`);
}

// ── Import ──

export interface ImportResult {
  success: boolean;
  manifest: ProjectManifest | null;
  imported: string[];
  errors: string[];
  counts: Record<string, number>;
}

export async function importProjectFromZip(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    manifest: null,
    imported: [],
    errors: [],
    counts: {},
  };

  try {
    const zip = await JSZip.loadAsync(file);

    // 1. Read manifest
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) {
      result.errors.push("Arquivo ZIP não contém manifest.json - não é um export válido do HydroNetwork");
      return result;
    }

    const manifest: ProjectManifest = JSON.parse(await manifestFile.async("string"));
    if (manifest.platform !== "HydroNetwork") {
      result.errors.push(`Plataforma inválida: ${manifest.platform}. Esperado: HydroNetwork`);
      return result;
    }
    result.manifest = manifest;

    // 2. Import Plans
    const plansFile = zip.file("plans.json");
    if (plansFile) {
      try {
        const plans: SavedPlan[] = JSON.parse(await plansFile.async("string"));
        for (const plan of plans) {
          savePlan(plan);
        }
        result.imported.push("plans");
        result.counts.plans = plans.length;
      } catch (e) {
        result.errors.push(`Erro ao importar planos: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 3. Import RDOs
    const rdosFile = zip.file("rdos.json");
    if (rdosFile) {
      try {
        const importedRdos: RDO[] = JSON.parse(await rdosFile.async("string"));
        const existing = loadRDOs();
        const existingIds = new Set(existing.map(r => r.id));
        const newRdos = importedRdos.filter(r => !existingIds.has(r.id));
        saveRDOs([...newRdos, ...existing]);
        result.imported.push("rdos");
        result.counts.rdos = importedRdos.length;
        result.counts.rdosNew = newRdos.length;
      } catch (e) {
        result.errors.push(`Erro ao importar RDOs: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 4. Import Topography
    const topoFile = zip.file("topography.json");
    if (topoFile) {
      try {
        const content = await topoFile.async("string");
        const parsed = JSON.parse(content);
        if (parsed.pontos && parsed.trechos) {
          localStorage.setItem(LOCAL_STORAGE_KEYS.topographySnapshot, content);
          result.imported.push("topography");
          result.counts.pontos = parsed.pontos.length;
          result.counts.trechos = parsed.trechos.length;
        }
      } catch (e) {
        result.errors.push(`Erro ao importar topografia: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 5. Import BDI
    const bdiFile = zip.file("bdi_contracts.json");
    if (bdiFile) {
      try {
        const content = await bdiFile.async("string");
        localStorage.setItem(LOCAL_STORAGE_KEYS.bdiContracts, content);
        result.imported.push("bdi");
        result.counts.bdiContracts = JSON.parse(content).length;
      } catch (e) {
        result.errors.push(`Erro ao importar BDI: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 6. Import Equipment
    const equipFile = zip.file("equipment.json");
    if (equipFile) {
      try {
        const content = await equipFile.async("string");
        localStorage.setItem(LOCAL_STORAGE_KEYS.equipment, content);
        result.imported.push("equipment");
        result.counts.equipment = JSON.parse(content).length;
      } catch (e) {
        result.errors.push(`Erro ao importar equipamentos: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 7. Import Point Types
    const ptFile = zip.file("point_types.json");
    if (ptFile) {
      try {
        const content = await ptFile.async("string");
        localStorage.setItem(LOCAL_STORAGE_KEYS.pointTypes, content);
        result.imported.push("pointTypes");
      } catch (e) {
        result.errors.push(`Erro ao importar tipos de ponto: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 8. Import Templates
    const templFile = zip.file("import_templates.json");
    if (templFile) {
      try {
        const content = await templFile.async("string");
        localStorage.setItem(LOCAL_STORAGE_KEYS.importTemplates, content);
        result.imported.push("importTemplates");
      } catch (e) {
        result.errors.push(`Erro ao importar templates: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 9. Import History
    const histFile = zip.file("import_history.json");
    if (histFile) {
      try {
        const content = await histFile.async("string");
        localStorage.setItem(LOCAL_STORAGE_KEYS.importHistory, content);
        result.imported.push("importHistory");
      } catch (e) {
        result.errors.push(`Erro ao importar histórico: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 10. Import standalone trechos
    const trechosFile = zip.file("trechos.json");
    if (trechosFile) {
      try {
        const content = await trechosFile.async("string");
        localStorage.setItem(LOCAL_STORAGE_KEYS.trechos, content);
        result.imported.push("trechos");
        result.counts.trechosStandalone = JSON.parse(content).length;
      } catch (e) {
        result.errors.push(`Erro ao importar trechos: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    result.success = result.imported.length > 0;
  } catch (e) {
    result.errors.push(`Erro ao abrir ZIP: ${e instanceof Error ? e.message : String(e)}`);
  }

  return result;
}

// ── Preview (read ZIP contents without importing) ──

export async function previewZipContents(file: File): Promise<{
  manifest: ProjectManifest | null;
  files: string[];
  error?: string;
}> {
  try {
    const zip = await JSZip.loadAsync(file);
    const files = Object.keys(zip.files);

    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) {
      return { manifest: null, files, error: "Sem manifest.json" };
    }

    const manifest: ProjectManifest = JSON.parse(await manifestFile.async("string"));
    return { manifest, files };
  } catch (e) {
    return { manifest: null, files: [], error: e instanceof Error ? e.message : String(e) };
  }
}
