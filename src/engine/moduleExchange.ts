/**
 * Inter-Module Data Exchange Engine for HydroNetwork.
 *
 * Provides unified import/export functions so every module can:
 * - Import data from any other module
 * - Export data in CSV, GeoJSON, SHP-compatible formats
 * - All modules communicate through a shared data store
 */

import * as XLSX from "xlsx";
import type { Trecho } from "./domain";
import type { PontoTopografico } from "./reader";
import type { QuantRow } from "../components/hydronetwork/modules/QuantitiesModule";
import type { TrechoMedicao, MedicaoItem, RDOTrechoEntry } from "./medicao";
import type { RDO } from "./rdo";
import type { ScheduleResult, DailySegment } from "./planning";

// ══════════════════════════════════════
// Shared Data Store (localStorage-based)
// ══════════════════════════════════════

const KEYS = {
  pontos: "hydronetwork_pontos",
  trechos: "hydronetwork_trechos",
  quantRows: "hydronetwork_quant_rows",
  medicaoItems: "hydronetwork_medicao_items",
  medicaoTrechos: "hydronetwork_medicao_trechos",
  rdoTrechos: "hydronetwork_rdo_trechos",
  schedule: "hydronetwork_schedule",
  costBase: "hydronetwork_cost_base",
  snapshot: "hydroImportSnapshot",
  executedOverrides: "hydronetwork_executed_overrides",
} as const;

export interface ModuleData {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  quantRows: QuantRow[];
  medicaoItems: MedicaoItem[];
  medicaoTrechos: TrechoMedicao[];
  rdoTrechos: RDOTrechoEntry[];
  schedule: ScheduleResult | null;
}

/** Save data from a module to shared store and notify other modules. */
export function saveModuleData(key: keyof typeof KEYS, data: unknown): void {
  localStorage.setItem(KEYS[key], JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("hydronetwork:data-changed", { detail: { key } }));
}

/** Load data from shared store for a module. */
export function loadModuleData<T>(key: keyof typeof KEYS): T | null {
  const raw = localStorage.getItem(KEYS[key]);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

/** Load all shared data at once. */
export function loadAllModuleData(): ModuleData {
  return {
    pontos: loadModuleData<PontoTopografico[]>("pontos") || [],
    trechos: loadModuleData<Trecho[]>("trechos") || [],
    quantRows: loadModuleData<QuantRow[]>("quantRows") || [],
    medicaoItems: loadModuleData<MedicaoItem[]>("medicaoItems") || [],
    medicaoTrechos: loadModuleData<TrechoMedicao[]>("medicaoTrechos") || [],
    rdoTrechos: loadModuleData<RDOTrechoEntry[]>("rdoTrechos") || [],
    schedule: loadModuleData<ScheduleResult>("schedule"),
  };
}

// ══════════════════════════════════════
// Export helpers - All modules
// ══════════════════════════════════════

/** Export any data array as CSV. */
export function exportAsCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      if (typeof val === "number") return val.toString().replace(".", ",");
      return String(val);
    }).join(";")
  );
  const csv = [headers.join(";"), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export data as XLSX. */
export function exportAsExcel(
  sheets: { name: string; data: Record<string, unknown>[] }[],
  filename: string,
): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    if (sheet.data.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet.data), sheet.name);
    }
  }
  XLSX.writeFile(wb, filename);
}

/** Export as GeoJSON (line features). */
export function exportAsGeoJSON(
  trechos: Trecho[],
  properties: Record<string, unknown>[],
  filename: string,
): void {
  const features = trechos.map((t, i) => ({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [t.xInicio, t.yInicio, t.cotaInicio],
        [t.xFim, t.yFim, t.cotaFim],
      ],
    },
    properties: properties[i] || {},
  }));

  const fc = {
    type: "FeatureCollection",
    name: "HydroNetwork_Export",
    features,
  };

  const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════
// Module-specific import/export
// ══════════════════════════════════════

/** Export trechos + quantities for use in any module. */
export function exportTrechosWithAttributes(
  trechos: Trecho[],
  quantRows: QuantRow[],
): Record<string, unknown>[] {
  const quantMap = new Map<string, QuantRow>();
  quantRows.forEach((qr, i) => quantMap.set(`T${String(i + 1).padStart(2, "0")}`, qr));

  return trechos.map((t, idx) => {
    const id = `T${String(idx + 1).padStart(2, "0")}`;
    const qr = quantMap.get(id);
    return {
      trecho_id: id,
      inicio: t.idInicio,
      fim: t.idFim,
      comprimento: t.comprimento,
      dn: t.diametroMm,
      material: t.material,
      tipo_rede: t.tipoRede,
      declividade: t.declividade,
      x_inicio: t.xInicio,
      y_inicio: t.yInicio,
      cota_inicio: t.cotaInicio,
      x_fim: t.xFim,
      y_fim: t.yFim,
      cota_fim: t.cotaFim,
      prof: qr?.prof || 0,
      escavacao: qr?.escavacao || 0,
      reaterro: qr?.reaterro || 0,
      botafora: qr?.botafora || 0,
      pavimento: qr?.pavimento || 0,
      custo_total: qr?.custoTotal || 0,
    };
  });
}

/** Import trechos from CSV file. */
export function importTrechosFromCSV(csvText: string): Trecho[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  let delimiter = ",";
  if (lines[0].includes(";")) delimiter = ";";
  else if (lines[0].includes("\t")) delimiter = "\t";

  const headers = lines[0].split(delimiter).map(h =>
    h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );

  const findCol = (names: string[]): number => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const inicioIdx = findCol(["inicio", "id_inicio", "pvm", "node1"]);
  const fimIdx = findCol(["fim", "id_fim", "pvj", "node2"]);
  const compIdx = findCol(["comprimento", "comp", "length"]);
  const dnIdx = findCol(["dn", "diametro", "diameter"]);
  const materialIdx = findCol(["material", "mat"]);
  const tipoIdx = findCol(["tipo_rede", "tipo", "type"]);

  if (inicioIdx < 0 || fimIdx < 0) {
    throw new Error("Colunas inicio/fim não encontradas.");
  }

  const trechos: Trecho[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map(p => p.trim());
    if (parts.length <= Math.max(inicioIdx, fimIdx)) continue;

    trechos.push({
      idInicio: parts[inicioIdx],
      idFim: parts[fimIdx],
      comprimento: compIdx >= 0 ? parseFloat(parts[compIdx]) || 0 : 0,
      declividade: 0,
      tipoRede: tipoIdx >= 0 ? parts[tipoIdx] || "Esgoto por Gravidade" : "Esgoto por Gravidade",
      diametroMm: dnIdx >= 0 ? parseFloat(parts[dnIdx]) || 200 : 200,
      material: materialIdx >= 0 ? parts[materialIdx] || "PVC" : "PVC",
      xInicio: 0, yInicio: 0, cotaInicio: 0,
      xFim: 0, yFim: 0, cotaFim: 0,
    });
  }

  return trechos;
}
