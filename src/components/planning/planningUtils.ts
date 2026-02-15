import * as XLSX from 'xlsx';

// ===== CONSTANTS =====
export const DECLIVIDADE_MINIMA = 0.005;
export const DIAMETRO_PADRAO = 200;
export const MATERIAL_PADRAO = "PVC";

export const DIAMETRO_OPTIONS = [150, 200, 250, 300, 400];
export const MATERIAL_OPTIONS = ["PVC", "PEAD", "Ferro Fundido", "Concreto"];

// ===== TYPES =====
export interface TopoPoint {
  id: string;
  x: number;
  y: number;
  cota: number;
}

export interface CostEntry {
  tipo_rede: string;
  diametro_mm: number;
  custo_unitario: number;
}

export interface Trecho {
  index: number;
  id_inicio: string;
  id_fim: string;
  comprimento: number;
  declividade: number;
  declividade_percentual: number;
  tipo_rede: string;
  diametro_mm: number;
  material: string;
  custo_unitario: number;
  custo_total: number;
}

export interface ProjectConfig {
  nome: string;
  descricao: string;
  responsavel: string;
  data: string;
  diametro: number;
  material: string;
  declividade_minima: number;
  incluir_coordenadas: boolean;
}

export interface ProjectData {
  config: ProjectConfig;
  pontos: TopoPoint[];
  custos: CostEntry[];
  trechos: Trecho[];
  createdAt: string;
}

export interface ProjectSummary {
  totalTrechos: number;
  comprimentoTotal: number;
  custoTotal: number;
  custoMedio: number;
  gravityCount: number;
  gravityLength: number;
  gravityCost: number;
  pumpCount: number;
  pumpLength: number;
  pumpCost: number;
  declivMin: number;
  declivMax: number;
  declivMedia: number;
  desnivelTotal: number;
}

// ===== DEFAULT COST BASE (SINAPI-like) =====
export const DEFAULT_COSTS: CostEntry[] = [
  { tipo_rede: "Esgoto por Gravidade", diametro_mm: 150, custo_unitario: 85.50 },
  { tipo_rede: "Esgoto por Gravidade", diametro_mm: 200, custo_unitario: 120.00 },
  { tipo_rede: "Esgoto por Gravidade", diametro_mm: 250, custo_unitario: 165.00 },
  { tipo_rede: "Esgoto por Gravidade", diametro_mm: 300, custo_unitario: 210.00 },
  { tipo_rede: "Esgoto por Gravidade", diametro_mm: 400, custo_unitario: 320.00 },
  { tipo_rede: "Elevatória / Booster", diametro_mm: 150, custo_unitario: 250.00 },
  { tipo_rede: "Elevatória / Booster", diametro_mm: 200, custo_unitario: 320.00 },
  { tipo_rede: "Elevatória / Booster", diametro_mm: 250, custo_unitario: 410.00 },
  { tipo_rede: "Elevatória / Booster", diametro_mm: 300, custo_unitario: 520.00 },
  { tipo_rede: "Elevatória / Booster", diametro_mm: 400, custo_unitario: 680.00 },
];

// ===== FILE PARSING =====
export function parseFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Falha ao ler arquivo");

        if (file.name.endsWith('.csv')) {
          const text = data as string;
          const lines = text.trim().split('\n');
          if (lines.length < 2) throw new Error("Arquivo sem dados");
          const headers = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase().replace(/"/g, ''));
          const rows = lines.slice(1).map(line => {
            const values = line.split(/[,;\t]/).map(v => v.trim().replace(/"/g, ''));
            const obj: Record<string, unknown> = {};
            headers.forEach((h, i) => {
              const num = parseFloat(values[i]);
              obj[h] = isNaN(num) ? values[i] : num;
            });
            return obj;
          });
          resolve(rows);
        } else {
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
          resolve(rows);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

export function validateTopoData(data: Record<string, unknown>[]): { valid: boolean; points: TopoPoint[]; errors: string[] } {
  const errors: string[] = [];
  if (data.length < 2) errors.push("São necessários pelo menos 2 pontos topográficos.");

  const requiredCols = ['id', 'x', 'y', 'cota'];
  const keys = Object.keys(data[0] || {}).map(k => k.toLowerCase());
  requiredCols.forEach(col => {
    if (!keys.includes(col)) errors.push(`Coluna obrigatória "${col}" não encontrada.`);
  });

  if (errors.length > 0) return { valid: false, points: [], errors };

  const ids = new Set<string>();
  const points: TopoPoint[] = [];

  data.forEach((row, i) => {
    const id = String(row.id || row.ID || row.Id || '');
    const x = Number(row.x || row.X || 0);
    const y = Number(row.y || row.Y || 0);
    const cota = Number(row.cota || row.Cota || row.COTA || 0);

    if (!id) { errors.push(`Linha ${i + 2}: ID vazio.`); return; }
    if (ids.has(id)) { errors.push(`Linha ${i + 2}: ID "${id}" duplicado.`); return; }
    if (isNaN(x) || isNaN(y) || isNaN(cota)) { errors.push(`Linha ${i + 2}: valores numéricos inválidos.`); return; }

    ids.add(id);
    points.push({ id, x, y, cota });
  });

  return { valid: errors.length === 0, points, errors };
}

export function validateCostData(data: Record<string, unknown>[]): { valid: boolean; costs: CostEntry[]; errors: string[] } {
  const errors: string[] = [];
  if (data.length === 0) errors.push("Base de custos vazia.");

  const requiredCols = ['tipo_rede', 'diametro_mm', 'custo_unitario'];
  const keys = Object.keys(data[0] || {}).map(k => k.toLowerCase());
  requiredCols.forEach(col => {
    if (!keys.includes(col)) errors.push(`Coluna obrigatória "${col}" não encontrada.`);
  });

  if (errors.length > 0) return { valid: false, costs: [], errors };

  const costs: CostEntry[] = data.map(row => ({
    tipo_rede: String(row.tipo_rede || row.Tipo_Rede || row.TIPO_REDE || ''),
    diametro_mm: Number(row.diametro_mm || row.Diametro_mm || row.DIAMETRO_MM || 0),
    custo_unitario: Number(row.custo_unitario || row.Custo_Unitario || row.CUSTO_UNITARIO || 0),
  }));

  return { valid: true, costs, errors };
}

// ===== CORE CALCULATIONS =====
export function calculateTrechos(
  points: TopoPoint[],
  costs: CostEntry[],
  config: { diametro: number; material: string; declividade_minima: number }
): Trecho[] {
  const trechos: Trecho[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const comprimento = Math.sqrt(dx * dx + dy * dy);

    const declividade = comprimento > 0 ? (p1.cota - p2.cota) / comprimento : 0;
    const tipo_rede = declividade >= config.declividade_minima
      ? "Esgoto por Gravidade"
      : "Elevatória / Booster";

    const costEntry = costs.find(
      c => c.tipo_rede === tipo_rede && c.diametro_mm === config.diametro
    );
    const custo_unitario = costEntry?.custo_unitario || 0;

    trechos.push({
      index: i + 1,
      id_inicio: p1.id,
      id_fim: p2.id,
      comprimento: parseFloat(comprimento.toFixed(2)),
      declividade: parseFloat(declividade.toFixed(6)),
      declividade_percentual: parseFloat((declividade * 100).toFixed(2)),
      tipo_rede,
      diametro_mm: config.diametro,
      material: config.material,
      custo_unitario,
      custo_total: parseFloat((comprimento * custo_unitario).toFixed(2)),
    });
  }

  return trechos;
}

export function calculateSummary(trechos: Trecho[], pontos: TopoPoint[]): ProjectSummary {
  const gravity = trechos.filter(t => t.tipo_rede === "Esgoto por Gravidade");
  const pump = trechos.filter(t => t.tipo_rede === "Elevatória / Booster");

  const comprimentoTotal = trechos.reduce((s, t) => s + t.comprimento, 0);
  const custoTotal = trechos.reduce((s, t) => s + t.custo_total, 0);
  const declividades = trechos.map(t => t.declividade_percentual);

  return {
    totalTrechos: trechos.length,
    comprimentoTotal: parseFloat(comprimentoTotal.toFixed(2)),
    custoTotal: parseFloat(custoTotal.toFixed(2)),
    custoMedio: comprimentoTotal > 0 ? parseFloat((custoTotal / comprimentoTotal).toFixed(2)) : 0,
    gravityCount: gravity.length,
    gravityLength: parseFloat(gravity.reduce((s, t) => s + t.comprimento, 0).toFixed(2)),
    gravityCost: parseFloat(gravity.reduce((s, t) => s + t.custo_total, 0).toFixed(2)),
    pumpCount: pump.length,
    pumpLength: parseFloat(pump.reduce((s, t) => s + t.comprimento, 0).toFixed(2)),
    pumpCost: parseFloat(pump.reduce((s, t) => s + t.custo_total, 0).toFixed(2)),
    declivMin: declividades.length > 0 ? Math.min(...declividades) : 0,
    declivMax: declividades.length > 0 ? Math.max(...declividades) : 0,
    declivMedia: declividades.length > 0 ? parseFloat((declividades.reduce((a, b) => a + b, 0) / declividades.length).toFixed(2)) : 0,
    desnivelTotal: pontos.length > 0 ? parseFloat((Math.max(...pontos.map(p => p.cota)) - Math.min(...pontos.map(p => p.cota))).toFixed(2)) : 0,
  };
}

// ===== FORMATTING =====
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ===== ALERTS =====
export interface PlanningAlert {
  type: 'warning' | 'info';
  message: string;
  trechos?: string[];
}

export function generateAlerts(trechos: Trecho[]): PlanningAlert[] {
  const alerts: PlanningAlert[] = [];

  const pumpTrechos = trechos.filter(t => t.tipo_rede === "Elevatória / Booster");
  if (pumpTrechos.length > 0) {
    alerts.push({
      type: 'warning',
      message: `${pumpTrechos.length} trecho(s) requerem sistema de bombeamento (elevatória)`,
      trechos: pumpTrechos.map(t => `${t.id_inicio} → ${t.id_fim}`),
    });
  }

  const highSlope = trechos.filter(t => t.declividade_percentual > 10);
  if (highSlope.length > 0) {
    alerts.push({
      type: 'warning',
      message: `${highSlope.length} trecho(s) com declividade muito alta (>10%)`,
      trechos: highSlope.map(t => `${t.id_inicio} → ${t.id_fim} (${t.declividade_percentual}%)`),
    });
  }

  const longTrechos = trechos.filter(t => t.comprimento > 200);
  if (longTrechos.length > 0) {
    alerts.push({
      type: 'info',
      message: `${longTrechos.length} trecho(s) com comprimento superior a 200m — considere pontos intermediários`,
      trechos: longTrechos.map(t => `${t.id_inicio} → ${t.id_fim} (${formatNumber(t.comprimento)}m)`),
    });
  }

  return alerts;
}

// ===== LOCAL STORAGE =====
const STORAGE_KEY = 'planning_projects';

export function saveProject(project: ProjectData): void {
  const projects = getProjects();
  const existing = projects.findIndex(p => p.config.nome === project.config.nome && p.createdAt === project.createdAt);
  if (existing >= 0) {
    projects[existing] = project;
  } else {
    projects.unshift(project);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, 20)));
}

export function getProjects(): ProjectData[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function deleteProject(createdAt: string): void {
  const projects = getProjects().filter(p => p.createdAt !== createdAt);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}
