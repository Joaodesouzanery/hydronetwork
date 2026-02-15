/**
 * Budget calculation module for sanitation network costing.
 * Ported from Python engine_rede/budget.py
 */

import * as XLSX from "xlsx";
import { Trecho, trechoToRecord } from "./domain";

export class BudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetError";
  }
}

export interface CostEntry {
  tipoRede: string;
  diametroMm: number;
  custoUnitario: number;
}

export class CostBase {
  private lookup: Map<string, number>;
  private entries: CostEntry[];

  constructor(entries: CostEntry[]) {
    this.entries = entries;
    this.lookup = new Map();
    for (const entry of entries) {
      const key = `${entry.tipoRede}|${entry.diametroMm}`;
      this.lookup.set(key, entry.custoUnitario);
    }
  }

  getUnitCost(tipoRede: string, diametroMm: number): number | null {
    const key = `${tipoRede}|${diametroMm}`;
    return this.lookup.get(key) ?? null;
  }

  hasCost(tipoRede: string, diametroMm: number): boolean {
    return this.lookup.has(`${tipoRede}|${diametroMm}`);
  }

  get size(): number {
    return this.lookup.size;
  }
}

/**
 * Parse cost base from CSV text.
 */
export function parseCostBaseCSV(csvText: string): CostBase {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) throw new BudgetError("Cost base CSV must have header and data rows.");

  let delimiter = ",";
  if (lines[0].includes(";")) delimiter = ";";
  else if (lines[0].includes("\t")) delimiter = "\t";

  const headers = lines[0].split(delimiter).map((h) => h.toLowerCase().trim());
  const required = ["tipo_rede", "diametro_mm", "custo_unitario"];
  const missing = required.filter((r) => !headers.includes(r));
  if (missing.length > 0) {
    throw new BudgetError(`Cost base missing columns: ${missing.join(", ")}`);
  }

  const tipoIdx = headers.indexOf("tipo_rede");
  const diamIdx = headers.indexOf("diametro_mm");
  const custoIdx = headers.indexOf("custo_unitario");

  const entries: CostEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter);
    if (parts.length <= Math.max(tipoIdx, diamIdx, custoIdx)) continue;
    entries.push({
      tipoRede: parts[tipoIdx].trim(),
      diametroMm: parseInt(parts[diamIdx]),
      custoUnitario: parseFloat(parts[custoIdx]),
    });
  }

  return new CostBase(entries);
}

/**
 * Parse cost base from XLSX ArrayBuffer.
 */
export function parseCostBaseXLSX(buffer: ArrayBuffer): CostBase {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  if (data.length === 0) throw new BudgetError("Cost base file is empty.");

  const rawHeaders = Object.keys(data[0]);
  const headers = rawHeaders.map((h) => h.toLowerCase().trim());

  const colMap: Record<string, string> = {};
  rawHeaders.forEach((raw, i) => {
    colMap[headers[i]] = raw;
  });

  const required = ["tipo_rede", "diametro_mm", "custo_unitario"];
  const missing = required.filter((r) => !headers.includes(r));
  if (missing.length > 0) {
    throw new BudgetError(`Cost base missing columns: ${missing.join(", ")}`);
  }

  const entries: CostEntry[] = data.map((row) => ({
    tipoRede: String(row[colMap["tipo_rede"]] ?? "").trim(),
    diametroMm: Number(row[colMap["diametro_mm"]]),
    custoUnitario: Number(row[colMap["custo_unitario"]]),
  }));

  return new CostBase(entries);
}

/**
 * Parse cost base file (CSV or XLSX).
 */
export function parseCostBaseFile(file: File): Promise<CostBase> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv" || ext === "txt") {
      reader.onload = (e) => {
        try {
          resolve(parseCostBaseCSV(e.target?.result as string));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      reader.onload = (e) => {
        try {
          resolve(parseCostBaseXLSX(e.target?.result as ArrayBuffer));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reject(new BudgetError(`Unsupported cost base format: .${ext}`));
    }
  });
}

export interface BudgetRow {
  id_inicio: string;
  id_fim: string;
  comprimento: number;
  declividade: number;
  tipo_rede: string;
  diametro_mm: number;
  material: string;
  custo_unitario: number | null;
  custo_total: number | null;
}

/**
 * Apply budget calculations to network segments.
 */
export function applyBudget(
  trechos: Trecho[],
  costBase: CostBase,
  raiseOnMissing = true
): BudgetRow[] {
  if (trechos.length === 0) return [];

  return trechos.map((t) => {
    const unitCost = costBase.getUnitCost(t.tipoRede, t.diametroMm);

    if (unitCost === null && raiseOnMissing) {
      throw new BudgetError(
        `No cost found for tipo_rede='${t.tipoRede}', diametro_mm=${t.diametroMm}. ` +
          `Segment: ${t.idInicio} → ${t.idFim}`
      );
    }

    return {
      id_inicio: t.idInicio,
      id_fim: t.idFim,
      comprimento: Math.round(t.comprimento * 1000) / 1000,
      declividade: Math.round(t.declividade * 1000000) / 1000000,
      tipo_rede: t.tipoRede,
      diametro_mm: t.diametroMm,
      material: t.material,
      custo_unitario: unitCost,
      custo_total: unitCost !== null ? Math.round(t.comprimento * unitCost * 100) / 100 : null,
    };
  });
}

export interface BudgetSummary {
  totalSegments: number;
  totalLengthM: number;
  totalCost: number;
  costByNetworkType: Record<string, number>;
  averageCostPerMeter: number;
}

export function createBudgetSummary(budgetRows: BudgetRow[]): BudgetSummary {
  if (budgetRows.length === 0) {
    return {
      totalSegments: 0,
      totalLengthM: 0,
      totalCost: 0,
      costByNetworkType: {},
      averageCostPerMeter: 0,
    };
  }

  const totalCost = budgetRows.reduce((sum, r) => sum + (r.custo_total ?? 0), 0);
  const totalLength = budgetRows.reduce((sum, r) => sum + r.comprimento, 0);

  const costByType: Record<string, number> = {};
  for (const row of budgetRows) {
    const type = row.tipo_rede;
    costByType[type] = (costByType[type] ?? 0) + (row.custo_total ?? 0);
  }

  // Round values in costByType
  for (const key of Object.keys(costByType)) {
    costByType[key] = Math.round(costByType[key] * 100) / 100;
  }

  return {
    totalSegments: budgetRows.length,
    totalLengthM: Math.round(totalLength * 1000) / 1000,
    totalCost: Math.round(totalCost * 100) / 100,
    costByNetworkType: costByType,
    averageCostPerMeter: totalLength > 0 ? Math.round((totalCost / totalLength) * 100) / 100 : 0,
  };
}

/**
 * Export budget to XLSX download.
 */
export function exportBudgetExcel(budgetRows: BudgetRow[], filename = "orcamento_rede.xlsx"): void {
  const wb = XLSX.utils.book_new();

  // Main sheet
  const ws = XLSX.utils.json_to_sheet(budgetRows);
  XLSX.utils.book_append_sheet(wb, ws, "Orçamento");

  // Summary sheet
  const summary = createBudgetSummary(budgetRows);
  const summaryData = [
    { Métrica: "Total de Trechos", Valor: summary.totalSegments },
    { Métrica: "Comprimento Total (m)", Valor: summary.totalLengthM },
    { Métrica: "Custo Total (R$)", Valor: summary.totalCost },
    { Métrica: "Custo Médio por Metro (R$/m)", Valor: summary.averageCostPerMeter },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

  // Cost by type sheet
  if (Object.keys(summary.costByNetworkType).length > 0) {
    const typeData = Object.entries(summary.costByNetworkType).map(([tipo, custo]) => ({
      "Tipo de Rede": tipo,
      "Custo Total (R$)": custo,
    }));
    const wsType = XLSX.utils.json_to_sheet(typeData);
    XLSX.utils.book_append_sheet(wb, wsType, "Custo por Tipo");
  }

  XLSX.writeFile(wb, filename);
}
