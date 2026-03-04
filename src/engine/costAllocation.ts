/**
 * CostAllocation Engine — Allocates cost items from any cost base to specific trechos.
 * Each trecho can have its own unique set of cost items with editable quantities and costs.
 */

import type { CostBaseItem } from "./costBase";

// ── Types ──

export interface TrechoCostItem {
  id: string;
  costItemId: string;    // reference to CostBaseItem
  codigo: string;
  descricao: string;
  unidade: string;
  custoUnitario: number;
  quantidade: number;
  custoTotal: number;    // custoUnitario * quantidade
}

export interface TrechoCostAllocation {
  trechoKey: string;     // "idInicio-idFim"
  nomeTrecho: string;
  comprimento: number;
  items: TrechoCostItem[];
  custoTotalTrecho: number;
  bdiPct: number;
  custoComBDI: number;
}

// ── Storage ──

const STORAGE_KEY = "hydronetwork_cost_allocations";

export function loadAllocations(): TrechoCostAllocation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAllocations(allocs: TrechoCostAllocation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allocs));
}

// ── Allocation CRUD ──

export function getAllocation(trechoKey: string): TrechoCostAllocation | undefined {
  return loadAllocations().find(a => a.trechoKey === trechoKey);
}

export function createOrUpdateAllocation(alloc: TrechoCostAllocation): void {
  const allocs = loadAllocations();
  const idx = allocs.findIndex(a => a.trechoKey === alloc.trechoKey);
  if (idx >= 0) {
    allocs[idx] = alloc;
  } else {
    allocs.push(alloc);
  }
  saveAllocations(allocs);
}

export function recalculateAllocation(alloc: TrechoCostAllocation): TrechoCostAllocation {
  const items = alloc.items.map(item => ({
    ...item,
    custoTotal: Math.round(item.custoUnitario * item.quantidade * 100) / 100,
  }));
  const custoTotalTrecho = items.reduce((sum, i) => sum + i.custoTotal, 0);
  const custoComBDI = Math.round(custoTotalTrecho * (1 + alloc.bdiPct / 100) * 100) / 100;
  return { ...alloc, items, custoTotalTrecho, custoComBDI };
}

export function addItemToTrecho(
  trechoKey: string,
  nomeTrecho: string,
  comprimento: number,
  costItem: CostBaseItem,
  quantidade: number
): TrechoCostAllocation {
  let alloc = getAllocation(trechoKey) || {
    trechoKey,
    nomeTrecho,
    comprimento,
    items: [],
    custoTotalTrecho: 0,
    bdiPct: 25,
    custoComBDI: 0,
  };

  const newItem: TrechoCostItem = {
    id: crypto.randomUUID(),
    costItemId: costItem.id,
    codigo: costItem.codigo,
    descricao: costItem.descricao,
    unidade: costItem.unidade,
    custoUnitario: costItem.custoUnitario,
    quantidade,
    custoTotal: Math.round(costItem.custoUnitario * quantidade * 100) / 100,
  };

  alloc.items.push(newItem);
  alloc = recalculateAllocation(alloc);
  createOrUpdateAllocation(alloc);
  return alloc;
}

export function removeItemFromTrecho(trechoKey: string, itemId: string): TrechoCostAllocation | null {
  let alloc = getAllocation(trechoKey);
  if (!alloc) return null;
  alloc.items = alloc.items.filter(i => i.id !== itemId);
  alloc = recalculateAllocation(alloc);
  createOrUpdateAllocation(alloc);
  return alloc;
}

export function updateTrechoItem(
  trechoKey: string,
  itemId: string,
  updates: Partial<TrechoCostItem>
): TrechoCostAllocation | null {
  let alloc = getAllocation(trechoKey);
  if (!alloc) return null;
  const idx = alloc.items.findIndex(i => i.id === itemId);
  if (idx < 0) return null;
  alloc.items[idx] = { ...alloc.items[idx], ...updates };
  alloc = recalculateAllocation(alloc);
  createOrUpdateAllocation(alloc);
  return alloc;
}

export function updateTrechoBDI(trechoKey: string, bdiPct: number): TrechoCostAllocation | null {
  let alloc = getAllocation(trechoKey);
  if (!alloc) return null;
  alloc.bdiPct = bdiPct;
  alloc = recalculateAllocation(alloc);
  createOrUpdateAllocation(alloc);
  return alloc;
}

// ── Bulk operations ──

export function allocateItemToMultipleTrechos(
  trechoKeys: { key: string; nome: string; comprimento: number }[],
  costItem: CostBaseItem,
  quantidadePorTrecho: number | "auto"
): TrechoCostAllocation[] {
  return trechoKeys.map(({ key, nome, comprimento }) => {
    const qty = quantidadePorTrecho === "auto" ? comprimento : quantidadePorTrecho;
    return addItemToTrecho(key, nome, comprimento, costItem, qty);
  });
}

// ── Summary ──

export interface AllocationSummary {
  totalTrechos: number;
  totalItems: number;
  custoTotal: number;
  custoComBDI: number;
  mediaCustoPorTrecho: number;
  porCategoria: Record<string, number>;
}

export function getAllocationSummary(): AllocationSummary {
  const allocs = loadAllocations();
  const totalItems = allocs.reduce((sum, a) => sum + a.items.length, 0);
  const custoTotal = allocs.reduce((sum, a) => sum + a.custoTotalTrecho, 0);
  const custoComBDI = allocs.reduce((sum, a) => sum + a.custoComBDI, 0);

  const porCategoria: Record<string, number> = {};
  for (const alloc of allocs) {
    for (const item of alloc.items) {
      const cat = item.descricao.split(" ")[0] || "Outros";
      porCategoria[cat] = (porCategoria[cat] || 0) + item.custoTotal;
    }
  }

  return {
    totalTrechos: allocs.length,
    totalItems,
    custoTotal: Math.round(custoTotal * 100) / 100,
    custoComBDI: Math.round(custoComBDI * 100) / 100,
    mediaCustoPorTrecho: allocs.length > 0 ? Math.round(custoComBDI / allocs.length * 100) / 100 : 0,
    porCategoria,
  };
}
