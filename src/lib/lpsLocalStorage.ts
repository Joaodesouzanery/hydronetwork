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
} as const;

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
  localStorage.setItem(key, JSON.stringify(data));
}

// ── Constraints ──

export function getConstraints(filters: ConstraintFilters): LpsConstraint[] {
  let items = readStore<LpsConstraint>(STORAGE_KEYS.constraints);

  if (filters.projectId) {
    items = items.filter(c => c.project_id === filters.projectId);
  }
  if (filters.serviceFrontId) {
    items = items.filter(c => c.service_front_id === filters.serviceFrontId);
  }
  if (filters.status && filters.status !== 'todas') {
    items = items.filter(c => c.status === filters.status);
  }
  if (filters.tipo && filters.tipo !== 'todos') {
    items = items.filter(c => c.tipo_restricao === filters.tipo);
  }
  if (filters.impacto && filters.impacto !== 'todos') {
    items = items.filter(c => c.impacto === filters.impacto);
  }
  if (filters.responsavelId) {
    items = items.filter(c => c.responsavel_id === filters.responsavelId);
  }
  if (filters.dateFrom) {
    items = items.filter(c => c.data_identificacao >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    items = items.filter(c => c.data_identificacao <= filters.dateTo!);
  }

  // Attach five whys
  const allFiveWhys = readStore<LpsFiveWhys>(STORAGE_KEYS.fiveWhys);
  items = items.map(c => ({
    ...c,
    lps_five_whys: allFiveWhys.filter(fw => fw.constraint_id === c.id),
  }));

  // Sort by date descending
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
  return newItem;
}

export function updateConstraint(id: string, data: Partial<LpsConstraint>): LpsConstraint {
  const items = readStore<LpsConstraint>(STORAGE_KEYS.constraints);
  const idx = items.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Restrição não encontrada');
  const { service_fronts, employees, projects, lps_five_whys, parent_constraint, child_constraints, ...cleanData } = data as any;
  items[idx] = { ...items[idx], ...cleanData, updated_at: now() };
  writeStore(STORAGE_KEYS.constraints, items);
  return items[idx];
}

export function deleteConstraint(id: string): void {
  const items = readStore<LpsConstraint>(STORAGE_KEYS.constraints);
  writeStore(STORAGE_KEYS.constraints, items.filter(c => c.id !== id));
  // Also delete related five whys
  const fiveWhys = readStore<LpsFiveWhys>(STORAGE_KEYS.fiveWhys);
  writeStore(STORAGE_KEYS.fiveWhys, fiveWhys.filter(fw => fw.constraint_id !== id));
}

export function resolveConstraint(id: string): void {
  const items = readStore<LpsConstraint>(STORAGE_KEYS.constraints);
  const idx = items.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Restrição não encontrada');
  items[idx] = { ...items[idx], status: 'resolvida', data_resolvida: today(), updated_at: now() };
  writeStore(STORAGE_KEYS.constraints, items);
}

// ── Commitments ──

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
  return newItem;
}

export function updateCommitment(id: string, data: Partial<LpsWeeklyCommitment>): LpsWeeklyCommitment {
  const items = readStore<LpsWeeklyCommitment>(STORAGE_KEYS.commitments);
  const idx = items.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Compromisso não encontrado');
  const { service_fronts, lps_constraints, ...cleanData } = data as any;
  items[idx] = { ...items[idx], ...cleanData, updated_at: now() };
  writeStore(STORAGE_KEYS.commitments, items);
  return items[idx];
}

// ── Five Whys ──

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
  return newItem;
}

export function updateFiveWhys(id: string, data: Partial<LpsFiveWhys>): LpsFiveWhys {
  const items = readStore<LpsFiveWhys>(STORAGE_KEYS.fiveWhys);
  const idx = items.findIndex(fw => fw.id === id);
  if (idx === -1) throw new Error('Análise não encontrada');
  items[idx] = { ...items[idx], ...data, updated_at: now() };
  writeStore(STORAGE_KEYS.fiveWhys, items);
  return items[idx];
}
