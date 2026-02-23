/**
 * Saved Planning engine - allows saving, loading, and editing planning configurations.
 * Plans include team config, productivity, holidays, schedule results, and trecho metadata.
 */

import { TeamConfig, ScheduleResult, DEFAULT_TEAM_CONFIG } from "./planning";
import { TipoRedeManual } from "./domain";

export interface TrechoMetadata {
  trechoKey: string; // idInicio-idFim
  nomeTrecho: string;
  codigoTrecho: string;
  tipoRedeManual: TipoRedeManual;
  frenteServico: string;
  lote: string;
  grupo: string;
}

export interface ProductivityEntry {
  servico: string;
  unidade: string;
  produtividade: number;
  fonte: string;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface SavedPlan {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  // Configuration
  numEquipes: number;
  teamConfig: TeamConfig;
  metrosDia: number;
  horasTrabalho: number;
  workDays: 5 | 6 | 7;
  dataInicio: string;
  dataTermino: string;
  // Data
  productivity: ProductivityEntry[];
  holidays: Holiday[];
  trechoMetadata: TrechoMetadata[];
  // Schedule grouping
  groupingMode: "trecho" | "frente" | "lote" | "area" | "rede";
  // Optional saved schedule snapshot
  scheduleSnapshot?: {
    totalDays: number;
    totalMetros: number;
    totalCost: number;
    trechosCount: number;
  };
}

const STORAGE_KEY = "hydronetwork_saved_plans";

export function generatePlanId(): string {
  return "plan_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 8);
}

export function getSavedPlans(): SavedPlan[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function savePlan(plan: SavedPlan): void {
  const plans = getSavedPlans();
  const existingIdx = plans.findIndex(p => p.id === plan.id);
  plan.updatedAt = new Date().toISOString();
  if (existingIdx >= 0) {
    plans[existingIdx] = plan;
  } else {
    plan.createdAt = new Date().toISOString();
    plans.unshift(plan);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans.slice(0, 50)));
}

export function deleteSavedPlan(id: string): void {
  const plans = getSavedPlans().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export function duplicatePlan(id: string): SavedPlan | null {
  const plans = getSavedPlans();
  const original = plans.find(p => p.id === id);
  if (!original) return null;
  const copy: SavedPlan = {
    ...JSON.parse(JSON.stringify(original)),
    id: generatePlanId(),
    name: `${original.name} (Cópia)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  plans.unshift(copy);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans.slice(0, 50)));
  return copy;
}

export function createDefaultPlan(name: string): SavedPlan {
  return {
    id: generatePlanId(),
    name,
    description: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    numEquipes: 2,
    teamConfig: { ...DEFAULT_TEAM_CONFIG },
    metrosDia: 12,
    horasTrabalho: 8,
    workDays: 5,
    dataInicio: new Date().toISOString().split("T")[0],
    dataTermino: "",
    productivity: [
      { servico: "Assentamento tubo PVC DN200", unidade: "m", produtividade: 35, fonte: "SEINFRA" },
      { servico: "Reaterro compactado", unidade: "m³", produtividade: 25, fonte: "SINAPI" },
      { servico: "Escoramento contínuo", unidade: "m²", produtividade: 15, fonte: "TCPO" },
      { servico: "Lastro de brita", unidade: "m³", produtividade: 20, fonte: "SINAPI" },
      { servico: "Recomposição asfalto (CBUQ)", unidade: "m²", produtividade: 80, fonte: "SEINFRA" },
      { servico: "Poço de visita (PV) h≤2m", unidade: "un", produtividade: 1, fonte: "SINAPI" },
      { servico: "Poço de visita (PV) h>2m", unidade: "un", produtividade: 0.5, fonte: "SINAPI" },
      { servico: "Teste de estanqueidade", unidade: "m", produtividade: 200, fonte: "SEINFRA" },
    ],
    holidays: [],
    trechoMetadata: [],
    groupingMode: "trecho",
  };
}

export function applyNamingPattern(
  metadata: TrechoMetadata[],
  selectedKeys: string[],
  prefix: string
): TrechoMetadata[] {
  const updated = [...metadata];
  let seq = 1;
  for (const key of selectedKeys) {
    const idx = updated.findIndex(m => m.trechoKey === key);
    const name = `${prefix}${String(seq).padStart(3, "0")}`;
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], nomeTrecho: name };
    } else {
      updated.push({
        trechoKey: key,
        nomeTrecho: name,
        codigoTrecho: "",
        tipoRedeManual: "esgoto",
        frenteServico: "",
        lote: "",
        grupo: "",
      });
    }
    seq++;
  }
  return updated;
}
