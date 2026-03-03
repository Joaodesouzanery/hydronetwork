/**
 * Saved Planning engine - allows saving, loading, and editing planning configurations.
 * Plans include team config, productivity, holidays, schedule results, and trecho metadata.
 * Uses Supabase for persistent storage with localStorage fallback.
 */

import { TeamConfig, DEFAULT_TEAM_CONFIG } from "./planning";
import { TipoRedeManual } from "./domain";
import { supabase } from "@/lib/supabase";

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
  return crypto.randomUUID();
}

// ── Supabase helpers ──

async function getUserId(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

function planToRow(plan: SavedPlan, userId?: string | null) {
  return {
    id: plan.id,
    user_id: userId || undefined,
    nome: plan.name,
    descricao: plan.description || "",
    num_equipes: plan.numEquipes,
    team_config: plan.teamConfig,
    metros_dia: plan.metrosDia,
    horas_trabalho: plan.horasTrabalho,
    work_days: plan.workDays,
    data_inicio: plan.dataInicio || null,
    data_termino: plan.dataTermino || null,
    productivity: plan.productivity,
    holidays: plan.holidays,
    trecho_metadata: plan.trechoMetadata,
    grouping_mode: plan.groupingMode,
    schedule_snapshot: plan.scheduleSnapshot || null,
    total_metros: plan.scheduleSnapshot?.totalMetros,
    total_dias: plan.scheduleSnapshot?.totalDays,
    custo_total: plan.scheduleSnapshot?.totalCost,
  };
}

function rowToPlan(r: any): SavedPlan {
  return {
    id: r.id,
    name: r.nome,
    description: r.descricao || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    numEquipes: r.num_equipes,
    teamConfig: r.team_config,
    metrosDia: Number(r.metros_dia),
    horasTrabalho: Number(r.horas_trabalho),
    workDays: r.work_days as 5 | 6 | 7,
    dataInicio: r.data_inicio || "",
    dataTermino: r.data_termino || "",
    productivity: r.productivity || [],
    holidays: r.holidays || [],
    trechoMetadata: r.trecho_metadata || [],
    groupingMode: r.grouping_mode || "trecho",
    scheduleSnapshot: r.schedule_snapshot || undefined,
  };
}

// ── Main API (Supabase-first with localStorage fallback) ──

export async function getSavedPlansAsync(): Promise<SavedPlan[]> {
  try {
    const userId = await getUserId();
    let query = supabase
      .from("hydro_saved_plans")
      .select("*")
      .order("updated_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) {
      // Sync cloud data to localStorage
      const plans = data.map(rowToPlan);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plans.slice(0, 50)));
      return plans;
    }
  } catch {
    // fallback
  }
  return getSavedPlans();
}

export async function savePlanAsync(plan: SavedPlan): Promise<void> {
  plan.updatedAt = new Date().toISOString();
  if (!plan.createdAt) plan.createdAt = plan.updatedAt;
  // Always save to localStorage first (immediate)
  savePlan(plan);
  try {
    const userId = await getUserId();
    const { error } = await supabase
      .from("hydro_saved_plans")
      .upsert(planToRow(plan, userId), { onConflict: "id" });
    if (error) throw error;
  } catch (err) {
    console.error("[SavedPlans] Falha ao salvar no Supabase:", err);
  }
}

export async function deleteSavedPlanAsync(id: string): Promise<void> {
  deleteSavedPlan(id);
  try {
    const userId = await getUserId();
    let query = supabase.from("hydro_saved_plans").delete().eq("id", id);
    if (userId) query = query.eq("user_id", userId);
    await query;
  } catch (err) {
    console.error("[SavedPlans] Falha ao deletar no Supabase:", err);
  }
}

export async function duplicatePlanAsync(id: string): Promise<SavedPlan | null> {
  const plans = await getSavedPlansAsync();
  const original = plans.find(p => p.id === id);
  if (!original) return null;
  const copy: SavedPlan = {
    ...JSON.parse(JSON.stringify(original)),
    id: generatePlanId(),
    name: `${original.name} (Cópia)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await savePlanAsync(copy); // savePlanAsync already handles user_id
  return copy;
}

// ── Sync localStorage functions (backward compat) ──

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
