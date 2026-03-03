/**
 * Last Planner System (LPS) Engine
 * Sistema Last Planner para planejamento lean de construção
 *
 * Módulos: Lookahead (médio prazo), Planejamento Semanal, PPC,
 * Análise de Restrições, Análise de Causas
 */

// ─── Tipos base ───

export type ConstraintCategory =
  | "projeto"
  | "material"
  | "mao_de_obra"
  | "equipamento"
  | "espaco"
  | "predecessora"
  | "clima"
  | "aprovacao"
  | "seguranca"
  | "outro";

export type ConstraintStatus = "identificada" | "em_resolucao" | "resolvida";

export type TaskStatus = "livre" | "restrita" | "em_andamento" | "concluida" | "nao_concluida";

export type NonCompletionCause =
  | "falta_material"
  | "falta_mao_obra"
  | "falta_equipamento"
  | "chuva_clima"
  | "retrabalho"
  | "predecessora_atrasada"
  | "projeto_incompleto"
  | "mudanca_prioridade"
  | "acesso_frente"
  | "seguranca"
  | "aprovacao_pendente"
  | "outro";

export const CONSTRAINT_LABELS: Record<ConstraintCategory, string> = {
  projeto: "Projeto/Engenharia",
  material: "Material",
  mao_de_obra: "Mão de Obra",
  equipamento: "Equipamento",
  espaco: "Espaço/Acesso",
  predecessora: "Atividade Predecessora",
  clima: "Condições Climáticas",
  aprovacao: "Aprovação/Liberação",
  seguranca: "Segurança do Trabalho",
  outro: "Outro",
};

export const CAUSE_LABELS: Record<NonCompletionCause, string> = {
  falta_material: "Falta de Material",
  falta_mao_obra: "Falta de Mão de Obra",
  falta_equipamento: "Falta de Equipamento",
  chuva_clima: "Chuva / Clima",
  retrabalho: "Retrabalho",
  predecessora_atrasada: "Predecessora Atrasada",
  projeto_incompleto: "Projeto Incompleto",
  mudanca_prioridade: "Mudança de Prioridade",
  acesso_frente: "Acesso à Frente de Serviço",
  seguranca: "Segurança do Trabalho",
  aprovacao_pendente: "Aprovação Pendente",
  outro: "Outro",
};

// ─── Interfaces ───

export interface LPSConstraint {
  id: string;
  taskId: string;
  category: ConstraintCategory;
  description: string;
  responsavel: string;
  prazoRemocao: string; // ISO date
  status: ConstraintStatus;
  resolvedAt?: string;
  notes?: string;
  tema?: string;
  impacto?: string;
  acoes?: string[];
  tags?: string[];
}

export interface LookaheadTask {
  id: string;
  trechoKey: string; // "idInicio-idFim"
  descricao: string;
  frenteServico: string;
  equipe: string;
  semana: number; // 1-6 (week in lookahead window)
  metrosPlanejados: number;
  status: TaskStatus;
  constraints: string[]; // constraint IDs
  prioridade: "alta" | "media" | "baixa";
}

export interface WeeklyCommitment {
  id: string;
  weekId: string; // "2024-W01" format
  weekStart: string; // ISO date (Monday)
  weekEnd: string; // ISO date (Friday/Saturday)
  tasks: WeeklyTask[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface WeeklyTask {
  id: string;
  lookaheadTaskId?: string;
  trechoKey: string;
  descricao: string;
  frenteServico: string;
  equipe: string;
  metrosComprometidos: number;
  metrosRealizados: number;
  concluida: boolean;
  causaNaoConclusao?: NonCompletionCause;
  observacao?: string;
}

export interface PPCRecord {
  id: string;
  weekId: string;
  weekStart: string;
  weekEnd: string;
  totalCommitments: number;
  completedCommitments: number;
  ppc: number; // 0-100
  causes: { cause: NonCompletionCause; count: number }[];
  createdAt: string;
}

export interface LPSData {
  id: string;
  projectName: string;
  lookaheadTasks: LookaheadTask[];
  constraints: LPSConstraint[];
  weeklyCommitments: WeeklyCommitment[];
  ppcRecords: PPCRecord[];
  config: LPSConfig;
  createdAt: string;
  updatedAt: string;
}

export interface LPSConfig {
  lookaheadWeeks: number; // default 6
  targetPPC: number; // default 80
  workDays: 5 | 6;
}

// ─── Default config ───

export const DEFAULT_LPS_CONFIG: LPSConfig = {
  lookaheadWeeks: 6,
  targetPPC: 80,
  workDays: 5,
};

// ─── ID generation ───

function generateId(): string {
  return `lps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Week helpers ───

export function getWeekId(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekFriday(date: Date): Date {
  const monday = getWeekMonday(date);
  monday.setDate(monday.getDate() + 4);
  return monday;
}

export function getWeekSaturday(date: Date): Date {
  const monday = getWeekMonday(date);
  monday.setDate(monday.getDate() + 5);
  return monday;
}

export function getLookaheadWeeks(startDate: Date, numWeeks: number): { weekId: string; start: Date; end: Date; label: string }[] {
  const weeks: { weekId: string; start: Date; end: Date; label: string }[] = [];
  const monday = getWeekMonday(startDate);
  for (let i = 0; i < numWeeks; i++) {
    const wStart = new Date(monday);
    wStart.setDate(wStart.getDate() + i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wEnd.getDate() + 6);
    const weekId = getWeekId(wStart);
    const label = `Sem ${i + 1} (${wStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })})`;
    weeks.push({ weekId, start: wStart, end: wEnd, label });
  }
  return weeks;
}

// ─── Factory functions ───

export function createLPSData(projectName: string): LPSData {
  return {
    id: generateId(),
    projectName,
    lookaheadTasks: [],
    constraints: [],
    weeklyCommitments: [],
    ppcRecords: [],
    config: { ...DEFAULT_LPS_CONFIG },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createLookaheadTask(partial: Partial<LookaheadTask> & { trechoKey: string; descricao: string }): LookaheadTask {
  return {
    id: generateId(),
    trechoKey: partial.trechoKey,
    descricao: partial.descricao,
    frenteServico: partial.frenteServico || "Frente 1",
    equipe: partial.equipe || "Equipe 1",
    semana: partial.semana || 1,
    metrosPlanejados: partial.metrosPlanejados || 0,
    status: partial.status || "livre",
    constraints: partial.constraints || [],
    prioridade: partial.prioridade || "media",
  };
}

export function createConstraint(partial: Partial<LPSConstraint> & { taskId: string; category: ConstraintCategory; description: string }): LPSConstraint {
  return {
    id: generateId(),
    taskId: partial.taskId,
    category: partial.category,
    description: partial.description,
    responsavel: partial.responsavel || "",
    prazoRemocao: partial.prazoRemocao || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    status: partial.status || "identificada",
    notes: partial.notes,
    tema: partial.tema || "",
    impacto: partial.impacto || "",
    acoes: partial.acoes || [],
    tags: partial.tags || [],
  };
}

export function createWeeklyCommitment(weekStart: Date, workDays: 5 | 6): WeeklyCommitment {
  const monday = getWeekMonday(weekStart);
  const end = workDays === 6 ? getWeekSaturday(weekStart) : getWeekFriday(weekStart);
  return {
    id: generateId(),
    weekId: getWeekId(weekStart),
    weekStart: monday.toISOString().split("T")[0],
    weekEnd: end.toISOString().split("T")[0],
    tasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createWeeklyTask(partial: Partial<WeeklyTask> & { trechoKey: string; descricao: string }): WeeklyTask {
  return {
    id: generateId(),
    lookaheadTaskId: partial.lookaheadTaskId,
    trechoKey: partial.trechoKey,
    descricao: partial.descricao,
    frenteServico: partial.frenteServico || "Frente 1",
    equipe: partial.equipe || "Equipe 1",
    metrosComprometidos: partial.metrosComprometidos || 0,
    metrosRealizados: partial.metrosRealizados || 0,
    concluida: partial.concluida || false,
    causaNaoConclusao: partial.causaNaoConclusao,
    observacao: partial.observacao,
  };
}

// ─── PPC Calculation ───

export function calculatePPC(commitment: WeeklyCommitment): PPCRecord {
  const total = commitment.tasks.length;
  const completed = commitment.tasks.filter(t => t.concluida).length;
  const ppc = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Aggregate causes
  const causeMap = new Map<NonCompletionCause, number>();
  commitment.tasks
    .filter(t => !t.concluida && t.causaNaoConclusao)
    .forEach(t => {
      const c = t.causaNaoConclusao!;
      causeMap.set(c, (causeMap.get(c) || 0) + 1);
    });

  const causes = Array.from(causeMap.entries())
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count);

  return {
    id: generateId(),
    weekId: commitment.weekId,
    weekStart: commitment.weekStart,
    weekEnd: commitment.weekEnd,
    totalCommitments: total,
    completedCommitments: completed,
    ppc,
    causes,
    createdAt: new Date().toISOString(),
  };
}

// ─── Analytics ───

export interface TagMetric {
  tag: string;
  total: number;
  identificada: number;
  em_resolucao: number;
  resolvida: number;
}

export interface LPSMetrics {
  avgPPC: number;
  currentPPC: number;
  ppcTrend: "up" | "down" | "stable";
  totalConstraints: number;
  openConstraints: number;
  resolvedConstraints: number;
  topCauses: { cause: NonCompletionCause; label: string; count: number; percent: number }[];
  constraintsByCategory: { category: ConstraintCategory; label: string; count: number }[];
  weeklyPPCData: { weekId: string; ppc: number; target: number }[];
  constraintsByTag: TagMetric[];
  allTags: string[];
}

export function calculateLPSMetrics(data: LPSData): LPSMetrics {
  const records = data.ppcRecords;
  const avgPPC = records.length > 0 ? Math.round(records.reduce((s, r) => s + r.ppc, 0) / records.length) : 0;
  const currentPPC = records.length > 0 ? records[records.length - 1].ppc : 0;

  let ppcTrend: "up" | "down" | "stable" = "stable";
  if (records.length >= 2) {
    const last = records[records.length - 1].ppc;
    const prev = records[records.length - 2].ppc;
    if (last > prev + 2) ppcTrend = "up";
    else if (last < prev - 2) ppcTrend = "down";
  }

  const totalConstraints = data.constraints.length;
  const openConstraints = data.constraints.filter(c => c.status !== "resolvida").length;
  const resolvedConstraints = data.constraints.filter(c => c.status === "resolvida").length;

  // Top causes (aggregate across all PPC records)
  const causeAgg = new Map<NonCompletionCause, number>();
  records.forEach(r => r.causes.forEach(c => causeAgg.set(c.cause, (causeAgg.get(c.cause) || 0) + c.count)));
  const totalCauses = Array.from(causeAgg.values()).reduce((s, v) => s + v, 0);
  const topCauses = Array.from(causeAgg.entries())
    .map(([cause, count]) => ({
      cause,
      label: CAUSE_LABELS[cause],
      count,
      percent: totalCauses > 0 ? Math.round((count / totalCauses) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Constraints by category
  const catMap = new Map<ConstraintCategory, number>();
  data.constraints.forEach(c => catMap.set(c.category, (catMap.get(c.category) || 0) + 1));
  const constraintsByCategory = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, label: CONSTRAINT_LABELS[category], count }))
    .sort((a, b) => b.count - a.count);

  const weeklyPPCData = records.map(r => ({
    weekId: r.weekId,
    ppc: r.ppc,
    target: data.config.targetPPC,
  }));

  // Constraints by tag
  const tagMap = new Map<string, { total: number; identificada: number; em_resolucao: number; resolvida: number }>();
  const allTagsSet = new Set<string>();
  data.constraints.forEach(c => {
    const tags = c.tags || [];
    tags.forEach(tag => {
      allTagsSet.add(tag);
      const entry = tagMap.get(tag) || { total: 0, identificada: 0, em_resolucao: 0, resolvida: 0 };
      entry.total++;
      entry[c.status]++;
      tagMap.set(tag, entry);
    });
  });
  const constraintsByTag: TagMetric[] = Array.from(tagMap.entries())
    .map(([tag, counts]) => ({ tag, ...counts }))
    .sort((a, b) => b.total - a.total);
  const allTags = Array.from(allTagsSet).sort();

  return {
    avgPPC, currentPPC, ppcTrend,
    totalConstraints, openConstraints, resolvedConstraints,
    topCauses, constraintsByCategory, weeklyPPCData,
    constraintsByTag, allTags,
  };
}

// ─── LocalStorage persistence ───

const LPS_STORAGE_KEY = "hydronetwork_lps_data";

export function saveLPSData(data: LPSData): void {
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(LPS_STORAGE_KEY, JSON.stringify(data));
}

export function loadLPSData(): LPSData | null {
  const raw = localStorage.getItem(LPS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LPSData;
  } catch {
    return null;
  }
}

export function deleteLPSData(): void {
  localStorage.removeItem(LPS_STORAGE_KEY);
}
