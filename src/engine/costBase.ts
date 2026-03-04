/**
 * CostBase Engine — Manages custom cost bases imported by the user.
 * Supports XLSX, CSV, JSON import with column mapping.
 * All items are 100% editable (code, description, unit, cost, productivity, composition).
 * No dependency on SINAPI — user chooses their own base.
 */

import * as XLSX from "xlsx";

// ── Types ──

export interface CostBaseItem {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  custoUnitario: number;
  produtividade: number;
  composicao: string;
  fonte: string; // name of the imported base
  categoria: string; // user-defined category
}

export interface CostBase {
  id: string;
  nome: string;
  descricao: string;
  createdAt: string;
  updatedAt: string;
  items: CostBaseItem[];
}

export interface ColumnMapping {
  codigo: string;
  descricao: string;
  unidade: string;
  custoUnitario: string;
  produtividade: string;
  composicao: string;
}

export interface ImportPreview {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
  rawData: Record<string, unknown>[];
}

// ── Storage ──

const STORAGE_KEY = "hydronetwork_cost_bases";

export function loadCostBases(): CostBase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCostBases(bases: CostBase[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bases));
}

export function saveCostBase(base: CostBase): void {
  const all = loadCostBases();
  const idx = all.findIndex(b => b.id === base.id);
  if (idx >= 0) {
    all[idx] = { ...base, updatedAt: new Date().toISOString() };
  } else {
    all.push(base);
  }
  saveCostBases(all);
}

export function deleteCostBase(id: string): void {
  const all = loadCostBases().filter(b => b.id !== id);
  saveCostBases(all);
}

// ── Import: Parse files ──

export function parseCSVText(text: string): ImportPreview {
  const lines = text.trim().split("\n");
  if (lines.length < 2) throw new Error("Arquivo CSV deve ter cabeçalho e pelo menos 1 linha de dados.");

  // Detect separator
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ""));

  const rawData: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
    if (vals.length < 2) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      row[h] = vals[j] ?? "";
    });
    rawData.push(row);
  }

  return {
    headers,
    sampleRows: rawData.slice(0, 5),
    totalRows: rawData.length,
    rawData,
  };
}

export function parseXLSXBuffer(buffer: ArrayBuffer): ImportPreview {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  if (data.length === 0) throw new Error("Planilha vazia.");

  const headers = Object.keys(data[0]);

  return {
    headers,
    sampleRows: data.slice(0, 5),
    totalRows: data.length,
    rawData: data,
  };
}

export function parseJSONText(text: string): ImportPreview {
  const parsed = JSON.parse(text);
  const data: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : parsed.items || parsed.data || [];
  if (data.length === 0) throw new Error("JSON vazio ou sem array de itens.");

  const headers = Object.keys(data[0]);

  return {
    headers,
    sampleRows: data.slice(0, 5),
    totalRows: data.length,
    rawData: data,
  };
}

export function parseFile(file: File): Promise<ImportPreview> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();

    if (ext === "csv" || ext === "txt") {
      reader.onload = e => {
        try {
          resolve(parseCSVText(e.target?.result as string));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      reader.onload = e => {
        try {
          resolve(parseXLSXBuffer(e.target?.result as ArrayBuffer));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === "json") {
      reader.onload = e => {
        try {
          resolve(parseJSONText(e.target?.result as string));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    } else {
      reject(new Error(`Formato não suportado: .${ext}. Use XLSX, CSV ou JSON.`));
    }
  });
}

// ── Apply column mapping to create CostBaseItems ──

export function applyMapping(
  rawData: Record<string, unknown>[],
  mapping: ColumnMapping,
  baseName: string
): CostBaseItem[] {
  return rawData.map((row, i) => ({
    id: crypto.randomUUID(),
    codigo: String(row[mapping.codigo] ?? `ITEM-${i + 1}`),
    descricao: String(row[mapping.descricao] ?? ""),
    unidade: String(row[mapping.unidade] ?? "un"),
    custoUnitario: parseFloat(String(row[mapping.custoUnitario] ?? "0").replace(",", ".")) || 0,
    produtividade: parseFloat(String(row[mapping.produtividade] ?? "0").replace(",", ".")) || 0,
    composicao: String(row[mapping.composicao] ?? ""),
    fonte: baseName,
    categoria: "",
  }));
}

// ── Create a new cost base from import ──

export function createCostBaseFromImport(
  nome: string,
  descricao: string,
  rawData: Record<string, unknown>[],
  mapping: ColumnMapping
): CostBase {
  const items = applyMapping(rawData, mapping, nome);
  const base: CostBase = {
    id: crypto.randomUUID(),
    nome,
    descricao,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items,
  };
  saveCostBase(base);
  return base;
}

// ── CRUD operations on items ──

export function addItemToBase(baseId: string, item: Omit<CostBaseItem, "id">): CostBaseItem {
  const bases = loadCostBases();
  const base = bases.find(b => b.id === baseId);
  if (!base) throw new Error("Base de custo não encontrada.");
  const newItem: CostBaseItem = { ...item, id: crypto.randomUUID() };
  base.items.push(newItem);
  base.updatedAt = new Date().toISOString();
  saveCostBases(bases);
  return newItem;
}

export function updateItemInBase(baseId: string, itemId: string, updates: Partial<CostBaseItem>): void {
  const bases = loadCostBases();
  const base = bases.find(b => b.id === baseId);
  if (!base) throw new Error("Base de custo não encontrada.");
  const idx = base.items.findIndex(i => i.id === itemId);
  if (idx < 0) throw new Error("Item não encontrado.");
  base.items[idx] = { ...base.items[idx], ...updates };
  base.updatedAt = new Date().toISOString();
  saveCostBases(bases);
}

export function removeItemFromBase(baseId: string, itemId: string): void {
  const bases = loadCostBases();
  const base = bases.find(b => b.id === baseId);
  if (!base) throw new Error("Base de custo não encontrada.");
  base.items = base.items.filter(i => i.id !== itemId);
  base.updatedAt = new Date().toISOString();
  saveCostBases(bases);
}

// ── Export cost base ──

export function exportCostBaseToJSON(base: CostBase): string {
  return JSON.stringify(base, null, 2);
}

export function exportCostBaseToCSV(base: CostBase): string {
  const headers = ["codigo", "descricao", "unidade", "custo_unitario", "produtividade", "composicao", "categoria"];
  const lines = [headers.join(";")];
  for (const item of base.items) {
    lines.push([
      item.codigo,
      `"${item.descricao}"`,
      item.unidade,
      item.custoUnitario.toFixed(2),
      item.produtividade.toFixed(2),
      `"${item.composicao}"`,
      item.categoria,
    ].join(";"));
  }
  return lines.join("\n");
}
