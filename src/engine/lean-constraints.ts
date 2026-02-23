import type {
  LpsConstraint,
  LpsWeeklyCommitment,
  PPCResult,
  ConstraintsByArea,
  ConstraintType,
} from '@/types/lean-constraints';

export function calculatePPC(commitments: LpsWeeklyCommitment[]): PPCResult | null {
  if (commitments.length === 0) return null;

  const completed = commitments.filter(c => c.status === 'cumprido').length;
  const partial = commitments.filter(c => c.status === 'parcial').length;
  const notCompleted = commitments.filter(c => c.status === 'nao_cumprido').length;
  const total = commitments.length;

  return {
    weekStart: commitments[0]?.semana_inicio ?? '',
    weekEnd: commitments[0]?.semana_fim ?? '',
    totalCommitments: total,
    completed,
    partial,
    notCompleted,
    ppc: total > 0 ? Math.round((completed / total) * 100) : 0,
    ppcAdjusted: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function calculatePPCAdjusted(
  commitments: LpsWeeklyCommitment[],
  constraints: LpsConstraint[]
): PPCResult | null {
  if (commitments.length === 0) return null;

  const externalConstraintIds = new Set(
    constraints
      .filter(c => c.tipo_restricao === 'restricao_externa' || c.tipo_restricao === 'condicao_climatica')
      .map(c => c.id)
  );

  const adjustedCommitments = commitments.filter(
    c => !c.constraint_id || !externalConstraintIds.has(c.constraint_id)
  );

  const base = calculatePPC(commitments);
  if (!base) return null;

  const adjustedTotal = adjustedCommitments.length;
  const adjustedCompleted = adjustedCommitments.filter(c => c.status === 'cumprido').length;

  return {
    ...base,
    ppcAdjusted: adjustedTotal > 0 ? Math.round((adjustedCompleted / adjustedTotal) * 100) : 0,
  };
}

export function calculatePPCByWeek(
  commitments: LpsWeeklyCommitment[],
  constraints: LpsConstraint[]
): PPCResult[] {
  const weekMap = new Map<string, LpsWeeklyCommitment[]>();

  for (const c of commitments) {
    const key = c.semana_inicio;
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(c);
  }

  const results: PPCResult[] = [];
  for (const [, weekCommitments] of weekMap) {
    const result = calculatePPCAdjusted(weekCommitments, constraints);
    if (result) results.push(result);
  }

  return results.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function aggregateConstraintsByArea(
  constraints: LpsConstraint[]
): ConstraintsByArea[] {
  const areaMap = new Map<string, ConstraintsByArea>();

  for (const c of constraints) {
    const areaId = c.service_front_id || 'sem-frente';
    const areaName = c.service_fronts?.name || 'Sem Frente';

    if (!areaMap.has(areaId)) {
      areaMap.set(areaId, { areaId, areaName, total: 0, ativas: 0, criticas: 0, resolvidas: 0 });
    }

    const area = areaMap.get(areaId)!;
    area.total++;
    if (c.status === 'ativa') area.ativas++;
    else if (c.status === 'critica') area.criticas++;
    else if (c.status === 'resolvida') area.resolvidas++;
  }

  return Array.from(areaMap.values()).sort((a, b) => b.total - a.total);
}

export function aggregateConstraintsByType(
  constraints: LpsConstraint[]
): { tipo: ConstraintType; count: number }[] {
  const typeMap = new Map<ConstraintType, number>();

  for (const c of constraints) {
    typeMap.set(c.tipo_restricao, (typeMap.get(c.tipo_restricao) || 0) + 1);
  }

  return Array.from(typeMap.entries())
    .map(([tipo, count]) => ({ tipo, count }))
    .sort((a, b) => b.count - a.count);
}

export function calculateResolutionTimes(
  constraints: LpsConstraint[]
): { weekLabel: string; avgDays: number }[] {
  const resolved = constraints.filter(c => c.status === 'resolvida' && c.data_resolvida);

  const weekMap = new Map<string, number[]>();

  for (const c of resolved) {
    const identified = new Date(c.data_identificacao);
    const resolvedDate = new Date(c.data_resolvida!);
    const days = Math.max(0, Math.round((resolvedDate.getTime() - identified.getTime()) / (1000 * 60 * 60 * 24)));

    const weekStart = getWeekStart(resolvedDate);
    const label = formatWeekLabel(weekStart);

    if (!weekMap.has(label)) weekMap.set(label, []);
    weekMap.get(label)!.push(days);
  }

  return Array.from(weekMap.entries())
    .map(([weekLabel, days]) => ({
      weekLabel,
      avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
    }))
    .sort((a, b) => a.weekLabel.localeCompare(b.weekLabel));
}

export function calculateWeeklyEvolution(
  constraints: LpsConstraint[]
): { weekLabel: string; novas: number; resolvidas: number; ativas: number }[] {
  const weekMap = new Map<string, { novas: number; resolvidas: number }>();

  for (const c of constraints) {
    const identifiedWeek = formatWeekLabel(getWeekStart(new Date(c.data_identificacao)));
    if (!weekMap.has(identifiedWeek)) weekMap.set(identifiedWeek, { novas: 0, resolvidas: 0 });
    weekMap.get(identifiedWeek)!.novas++;

    if (c.data_resolvida) {
      const resolvedWeek = formatWeekLabel(getWeekStart(new Date(c.data_resolvida)));
      if (!weekMap.has(resolvedWeek)) weekMap.set(resolvedWeek, { novas: 0, resolvidas: 0 });
      weekMap.get(resolvedWeek)!.resolvidas++;
    }
  }

  const sorted = Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  let cumActive = 0;
  return sorted.map(([weekLabel, data]) => {
    cumActive += data.novas - data.resolvidas;
    return { weekLabel, novas: data.novas, resolvidas: data.resolvidas, ativas: cumActive };
  });
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekRange(date: Date): { start: string; end: string } {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function formatWeekLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function getDefaultConstraintType(justificationType?: ConstraintType): ConstraintType {
  return justificationType || 'restricao_externa';
}
