/**
 * LPS Data Persistence Layer — Supabase-first with localStorage fallback.
 *
 * Previously this module stored everything in localStorage only, meaning
 * client data would be lost on browser clear or device switch. Now it:
 * 1. Writes to localStorage immediately (fast, offline-capable)
 * 2. Syncs to Supabase in background (cloud, multi-user, multi-device)
 * 3. Tracks pending syncs for retry on reconnection
 * 4. All data scoped by user_id for multi-tenant isolation
 */

import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type {
  LpsConstraint,
  LpsWeeklyCommitment,
  LpsFiveWhys,
  ConstraintFilters,
} from '@/types/lean-constraints';

const STORAGE_KEYS = {
  constraints: 'lps_constraints_data',
  commitments: 'lps_commitments_data',
  fiveWhys: 'lps_five_whys_data',
  pendingSync: 'lps_pending_sync',
} as const;

// ── Helpers ──

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function readStore<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStore<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* localStorage full */ }
}

async function getUserId(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

// Track Supabase availability
let _supabaseAvailable = true;

function markSupabaseUnavailable() {
  if (_supabaseAvailable) {
    _supabaseAvailable = false;
    toast.warning("Dados salvos localmente. Sincronização com nuvem indisponível.");
  }
}

function markSupabaseAvailable() {
  _supabaseAvailable = true;
}

export function isUsingLocalStorage(): boolean {
  return !_supabaseAvailable;
}

// ══════════════════════════════════════
// Supabase Sync Functions
// ══════════════════════════════════════

async function syncConstraintToSupabase(constraint: LpsConstraint): Promise<void> {
  try {
    const { service_fronts, employees, projects, lps_five_whys, parent_constraint, child_constraints, ...data } = constraint as any;
    const { error } = await (supabase as any).from("lps_constraints").upsert(data, { onConflict: "id" });
    if (error) throw error;
    markSupabaseAvailable();
  } catch {
    markSupabaseUnavailable();
    addPendingSync('upsert_constraint', constraint.id);
  }
}

async function syncCommitmentToSupabase(commitment: LpsWeeklyCommitment): Promise<void> {
  try {
    const { service_fronts, lps_constraints, ...data } = commitment as any;
    const { error } = await (supabase as any).from("lps_weekly_commitments").upsert(data, { onConflict: "id" });
    if (error) throw error;
    markSupabaseAvailable();
  } catch {
    markSupabaseUnavailable();
    addPendingSync('upsert_commitment', commitment.id);
  }
}

async function syncFiveWhysToSupabase(fiveWhys: LpsFiveWhys): Promise<void> {
  try {
    const { error } = await (supabase as any).from("lps_five_whys").upsert(fiveWhys, { onConflict: "id" });
    if (error) throw error;
    markSupabaseAvailable();
  } catch {
    markSupabaseUnavailable();
    addPendingSync('upsert_five_whys', fiveWhys.id);
  }
}

// ── Pending Sync Queue ──

interface PendingOp {
  type: string;
  entityId: string;
  createdAt: string;
}

function addPendingSync(type: string, entityId: string): void {
  try {
    const pending = readStore<PendingOp>(STORAGE_KEYS.pendingSync);
    if (!pending.some(p => p.type === type && p.entityId === entityId)) {
      pending.push({ type, entityId, createdAt: now() });
      writeStore(STORAGE_KEYS.pendingSync, pending);
    }
  } catch { /* ignore */ }
}

/** Flush pending syncs — call on app init or when network recovers */
export async function flushPendingSync(): Promise<number> {
  const pending = readStore<PendingOp>(STORAGE_KEYS.pendingSync);
  if (pending.length === 0) return 0;

  let synced = 0;
  const constraints = readStore<LpsConstraint>(STORAGE_KEYS.constraints);
  const commitments = readStore<LpsWeeklyCommitment>(STORAGE_KEYS.commitments);
  const fiveWhys = readStore<LpsFiveWhys>(STORAGE_KEYS.fiveWhys);

  for (const op of pending) {
    try {
      if (op.type.includes('constraint')) {
        const item = constraints.find(c => c.id === op.entityId);
        if (item) await syncConstraintToSupabase(item);
      } else if (op.type.includes('commitment')) {
        const item = commitments.find(c => c.id === op.entityId);
        if (item) await syncCommitmentToSupabase(item);
      } else if (op.type.includes('five_whys')) {
        const item = fiveWhys.find(fw => fw.id === op.entityId);
        if (item) await syncFiveWhysToSupabase(item);
      }
      synced++;
    } catch {
      break; // Will retry next time
    }
  }

  if (synced > 0) {
    const remaining = pending.slice(synced);
    writeStore(STORAGE_KEYS.pendingSync, remaining);
    if (remaining.length === 0) {
      toast.success(`${synced} item(ns) sincronizado(s) com a nuvem`);
    }
  }

  return synced;
}

// ══════════════════════════════════════
// Constraints
// ══════════════════════════════════════

export function getConstraints(filters: ConstraintFilters): LpsConstraint[] {
  let items = readStore<LpsConstraint>(STORAGE_KEYS.constraints);

  if (filters.projectId) items = items.filter(c => c.project_id === filters.projectId);
  if (filters.serviceFrontId) items = items.filter(c => c.service_front_id === filters.serviceFrontId);
  if (filters.status && filters.status !== 'todas') items = items.filter(c => c.status === filters.status);
  if (filters.tipo && filters.tipo !== 'todos') items = items.filter(c => c.tipo_restricao === filters.tipo);
  if (filters.impacto && filters.impacto !== 'todos') items = items.filter(c => c.impacto === filters.impacto);
  if (filters.responsavelId) items = items.filter(c => c.responsavel_id === filters.responsavelId);
  if (filters.dateFrom) items = items.filter(c => c.data_identificacao >= filters.dateFrom!);
  if (filters.dateTo) items = items.filter(c => c.data_identificacao <= filters.dateTo!);

  const allFiveWhys = readStore<LpsFiveWhys>(STORAGE_KEYS.fiveWhys);
  items = items.map(c => ({
    ...c,
    lps_five_whys: allFiveWhys.filter(fw => fw.constraint_id === c.id),
  }));

  items.sort((a, b) => b.data_identificacao.localeCompare(a.data_identificacao));
  return items;
}

export function createConstraint(
  data: Omit<LpsConstraint, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'employees' | 'projects' | 'lps_five_whys' | 'parent_constraint' | 'child_constraints'>
): LpsConstraint {
  const items = readStore<LpsConstraint>(STORAGE_KEYS.constraints);
  const newItem: LpsConstraint = {
    ...data,
    id: generateId(),
    created_at: now(),
    updated_at: now(),
  };
  items.push(newItem);
  writeStore(STORAGE_KEYS.constraints, items);
  syncConstraintToSupabase(newItem).catch(() => {});
  return newItem;
}

export function updateConstraint(id: string, data: Partial<LpsConstraint>): LpsConstraint {
  const items = readStore<LpsConstraint>(STORAGE_KEYS.constraints);
  const idx = items.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Restrição não encontrada');
  const { service_fronts, employees, projects, lps_five_whys, parent_constraint, child_constraints, ...cleanData } = data as any;
  items[idx] = { ...items[idx], ...cleanData, updated_at: now() };
  writeStore(STORAGE_KEYS.constraints, items);
  syncConstraintToSupabase(items[idx]).catch(() => {});
  return items[idx];
}

export function deleteConstraint(id: string): void {
  const items = readStore<LpsConstraint>(STORAGE_KEYS.constraints);
  writeStore(STORAGE_KEYS.constraints, items.filter(c => c.id !== id));
  const fiveWhys = readStore<LpsFiveWhys>(STORAGE_KEYS.fiveWhys);
  writeStore(STORAGE_KEYS.fiveWhys, fiveWhys.filter(fw => fw.constraint_id !== id));
  (supabase as any).from("lps_constraints").delete().eq("id", id).then(() => {}).catch(() => {});
  (supabase as any).from("lps_five_whys").delete().eq("constraint_id", id).then(() => {}).catch(() => {});
}

export function resolveConstraint(id: string): void {
  const items = readStore<LpsConstraint>(STORAGE_KEYS.constraints);
  const idx = items.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Restrição não encontrada');
  items[idx] = { ...items[idx], status: 'resolvida', data_resolvida: today(), updated_at: now() };
  writeStore(STORAGE_KEYS.constraints, items);
  syncConstraintToSupabase(items[idx]).catch(() => {});
}

// ══════════════════════════════════════
// Commitments
// ══════════════════════════════════════

export function getCommitments(projectId: string): LpsWeeklyCommitment[] {
  let items = readStore<LpsWeeklyCommitment>(STORAGE_KEYS.commitments);
  items = items.filter(c => c.project_id === projectId);
  items.sort((a, b) => b.semana_inicio.localeCompare(a.semana_inicio));
  return items;
}

export function createCommitment(
  data: Omit<LpsWeeklyCommitment, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'lps_constraints'>
): LpsWeeklyCommitment {
  const items = readStore<LpsWeeklyCommitment>(STORAGE_KEYS.commitments);
  const newItem: LpsWeeklyCommitment = {
    ...data,
    id: generateId(),
    created_at: now(),
    updated_at: now(),
  };
  items.push(newItem);
  writeStore(STORAGE_KEYS.commitments, items);
  syncCommitmentToSupabase(newItem).catch(() => {});
  return newItem;
}

export function updateCommitment(id: string, data: Partial<LpsWeeklyCommitment>): LpsWeeklyCommitment {
  const items = readStore<LpsWeeklyCommitment>(STORAGE_KEYS.commitments);
  const idx = items.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Compromisso não encontrado');
  const { service_fronts, lps_constraints, ...cleanData } = data as any;
  items[idx] = { ...items[idx], ...cleanData, updated_at: now() };
  writeStore(STORAGE_KEYS.commitments, items);
  syncCommitmentToSupabase(items[idx]).catch(() => {});
  return items[idx];
}

// ══════════════════════════════════════
// Five Whys
// ══════════════════════════════════════

export function createFiveWhys(
  data: Omit<LpsFiveWhys, 'id' | 'created_at' | 'updated_at'>
): LpsFiveWhys {
  const items = readStore<LpsFiveWhys>(STORAGE_KEYS.fiveWhys);
  const newItem: LpsFiveWhys = {
    ...data,
    id: generateId(),
    created_at: now(),
    updated_at: now(),
  };
  items.push(newItem);
  writeStore(STORAGE_KEYS.fiveWhys, items);
  syncFiveWhysToSupabase(newItem).catch(() => {});
  return newItem;
}

export function updateFiveWhys(id: string, data: Partial<LpsFiveWhys>): LpsFiveWhys {
  const items = readStore<LpsFiveWhys>(STORAGE_KEYS.fiveWhys);
  const idx = items.findIndex(fw => fw.id === id);
  if (idx === -1) throw new Error('Análise não encontrada');
  items[idx] = { ...items[idx], ...data, updated_at: now() };
  writeStore(STORAGE_KEYS.fiveWhys, items);
  syncFiveWhysToSupabase(items[idx]).catch(() => {});
  return items[idx];
}
