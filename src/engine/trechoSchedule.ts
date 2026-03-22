/**
 * TrechoSchedule Engine — Auto-generates schedule and Gantt data from trechos.
 * Schedule is based on: length, productivity, team count.
 * Updates automatically when costs, productivity, or measurements change.
 */

// ── Types ──

export interface TrechoScheduleItem {
  trechoKey: string;
  nomeTrecho: string;
  comprimento: number;
  produtividade: number;    // meters/day
  numEquipes: number;
  duracao: number;           // days (auto-calculated or manual)
  dataInicio: string;        // YYYY-MM-DD
  dataFim: string;           // YYYY-MM-DD
  custoTotal: number;
  progressoPct: number;      // from measurement
  dependencias: string[];    // trechoKeys that must finish before this starts
  manualDates: boolean;      // if user manually set dates
  cor: string;               // color for Gantt
}

export interface GanttItem {
  id: string;
  trecho: string;
  dataInicio: Date;
  dataFim: Date;
  duracao: number;
  progresso: number;
  custo: number;
  cor: string;
  // For rendering
  startDay: number;       // offset from project start
  widthDays: number;
}

export interface ScheduleConfig {
  dataInicioGlobal: string;
  produtividadeGlobal: number;
  numEquipesGlobal: number;
  diasUteisPorSemana: 5 | 6 | 7;
  feriados: string[];       // YYYY-MM-DD dates
}

// ── Storage ──

const STORAGE_KEY = "hydronetwork_trecho_schedule";
const CONFIG_KEY = "hydronetwork_schedule_config";

export function loadScheduleItems(): TrechoScheduleItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveScheduleItems(items: TrechoScheduleItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function loadScheduleConfig(): ScheduleConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fallthrough */ }
  return {
    dataInicioGlobal: new Date().toISOString().slice(0, 10),
    produtividadeGlobal: 12,
    numEquipesGlobal: 1,
    diasUteisPorSemana: 5,
    feriados: [],
  };
}

export function saveScheduleConfig(config: ScheduleConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// ── Schedule generation ──

function addBusinessDays(startDate: string, days: number, workDaysPerWeek: 5 | 6 | 7, feriados: string[]): string {
  const d = new Date(startDate + "T12:00:00");
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    const dateStr = d.toISOString().slice(0, 10);
    const isFeriado = feriados.includes(dateStr);

    let isWorkDay = true;
    if (workDaysPerWeek === 5 && (dow === 0 || dow === 6)) isWorkDay = false;
    if (workDaysPerWeek === 6 && dow === 0) isWorkDay = false;
    if (isFeriado) isWorkDay = false;

    if (isWorkDay) remaining--;
  }
  return d.toISOString().slice(0, 10);
}

export function calculateDuration(comprimento: number, produtividade: number, numEquipes: number): number {
  if (produtividade <= 0 || numEquipes <= 0) return 1;
  return Math.ceil(comprimento / (produtividade * numEquipes));
}

export interface TrechoInput {
  trechoKey: string;
  nomeTrecho: string;
  comprimento: number;
  custoTotal: number;
  progressoPct: number;
}

export function generateSchedule(
  trechos: TrechoInput[],
  config: ScheduleConfig
): TrechoScheduleItem[] {
  const existing = loadScheduleItems();
  const colors = ["#2563eb", "#ea580c", "#16a34a", "#7c3aed", "#dc2626", "#0891b2", "#ca8a04", "#be185d"];

  let currentDate = config.dataInicioGlobal;

  const items: TrechoScheduleItem[] = trechos.map((t, i) => {
    // Check if there's an existing item with manual dates
    const prev = existing.find(e => e.trechoKey === t.trechoKey);
    const produtividade = prev?.produtividade || config.produtividadeGlobal;
    const numEquipes = prev?.numEquipes || config.numEquipesGlobal;

    const duracao = calculateDuration(t.comprimento, produtividade, numEquipes);

    let dataInicio: string;
    let dataFim: string;
    let manualDates = false;

    if (prev?.manualDates) {
      dataInicio = prev.dataInicio;
      dataFim = prev.dataFim;
      manualDates = true;
    } else {
      dataInicio = currentDate;
      dataFim = addBusinessDays(dataInicio, duracao, config.diasUteisPorSemana, config.feriados);
      // Sequential: next trecho starts after this one
      currentDate = addBusinessDays(dataFim, 0, config.diasUteisPorSemana, config.feriados);
    }

    return {
      trechoKey: t.trechoKey,
      nomeTrecho: t.nomeTrecho,
      comprimento: t.comprimento,
      produtividade,
      numEquipes,
      duracao,
      dataInicio,
      dataFim,
      custoTotal: t.custoTotal,
      progressoPct: t.progressoPct,
      dependencias: prev?.dependencias || [],
      manualDates,
      cor: colors[i % colors.length],
    };
  });

  saveScheduleItems(items);
  return items;
}

// ── Update a single schedule item ──

export function updateScheduleItem(
  trechoKey: string,
  updates: Partial<TrechoScheduleItem>
): TrechoScheduleItem | null {
  const items = loadScheduleItems();
  const idx = items.findIndex(i => i.trechoKey === trechoKey);
  if (idx < 0) return null;

  items[idx] = { ...items[idx], ...updates };

  // If user set dates manually, mark it
  if (updates.dataInicio || updates.dataFim) {
    items[idx].manualDates = true;
  }

  // If productivity or teams changed, recalculate duration
  if (updates.produtividade || updates.numEquipes) {
    const item = items[idx];
    item.duracao = calculateDuration(item.comprimento, item.produtividade, item.numEquipes);
    if (!item.manualDates) {
      // Recalculate end date
      const config = loadScheduleConfig();
      item.dataFim = addBusinessDays(item.dataInicio, item.duracao, config.diasUteisPorSemana, config.feriados);
    }
  }

  saveScheduleItems(items);
  return items[idx];
}

// ── Generate Gantt data ──

export function generateGanttData(scheduleItems: TrechoScheduleItem[]): GanttItem[] {
  if (scheduleItems.length === 0) return [];

  const projectStart = new Date(
    scheduleItems.reduce((min, i) => i.dataInicio < min ? i.dataInicio : min, scheduleItems[0].dataInicio) + "T12:00:00"
  );

  return scheduleItems.map(item => {
    const start = new Date(item.dataInicio + "T12:00:00");
    const end = new Date(item.dataFim + "T12:00:00");
    const startDay = Math.round((start.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
    const widthDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      id: item.trechoKey,
      trecho: item.nomeTrecho,
      dataInicio: start,
      dataFim: end,
      duracao: item.duracao,
      progresso: item.progressoPct,
      custo: item.custoTotal,
      cor: item.cor,
      startDay,
      widthDays,
    };
  });
}

// ── Schedule summary ──

export interface ScheduleSummary {
  totalTrechos: number;
  duracaoTotal: number;
  dataInicioProjeto: string;
  dataFimProjeto: string;
  custoTotal: number;
  progressoMedio: number;
}

export function getScheduleSummary(items: TrechoScheduleItem[]): ScheduleSummary {
  if (items.length === 0) {
    return {
      totalTrechos: 0,
      duracaoTotal: 0,
      dataInicioProjeto: "",
      dataFimProjeto: "",
      custoTotal: 0,
      progressoMedio: 0,
    };
  }

  const dataInicio = items.reduce((min, i) => i.dataInicio < min ? i.dataInicio : min, items[0].dataInicio);
  const dataFim = items.reduce((max, i) => i.dataFim > max ? i.dataFim : max, items[0].dataFim);
  const duracaoTotal = Math.round(
    (new Date(dataFim + "T12:00:00").getTime() - new Date(dataInicio + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    totalTrechos: items.length,
    duracaoTotal,
    dataInicioProjeto: dataInicio,
    dataFimProjeto: dataFim,
    custoTotal: items.reduce((s, i) => s + i.custoTotal, 0),
    progressoMedio: items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.progressoPct, 0) / items.length * 100) / 100
      : 0,
  };
}
