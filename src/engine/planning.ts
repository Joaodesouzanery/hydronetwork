/**
 * Planning module for sanitation network construction scheduling.
 * Implements Same-Day Completion rule and multi-team allocation.
 */

import { Trecho } from "./domain";

export interface TeamConfig {
  encarregado: number;
  oficiais: number;
  ajudantes: number;
  operador: number;
  metrosDiaBase: number;
  hoursPerDay: number;
  hasRetro: boolean;
  hasCompactor: boolean;
  hasTruck: boolean;
  hasPump: boolean;
}

export const DEFAULT_TEAM_CONFIG: TeamConfig = {
  encarregado: 1,
  oficiais: 2,
  ajudantes: 4,
  operador: 1,
  metrosDiaBase: 12,
  hoursPerDay: 8,
  hasRetro: true,
  hasCompactor: true,
  hasTruck: false,
  hasPump: false,
};

export interface DailySegment {
  segmentId: string;
  trechoId: string;
  day: number;
  meters: number;
  team: number;
  activities: string[];
  volEscavacao: number;
  volReaterro: number;
  custoTotal: number;
}

export interface CurveSPoint {
  day: number;
  physicalPercent: number;
  financialPercent: number;
}

export interface HistogramDay {
  day: number;
  labor: number;
  equipment: number;
  cost: number;
}

export interface ScheduleResult {
  allSegments: DailySegment[];
  totalDays: number;
  endDate: Date;
  curveS: CurveSPoint[];
  histogram: HistogramDay[];
}

export function calculateDailyMeters(
  profundidade: number,
  diametro: number,
  team: TeamConfig
): number {
  let baseMetros = team.metrosDiaBase;

  // Adjust by depth
  if (profundidade > 3.0) baseMetros *= 0.5;
  else if (profundidade > 2.5) baseMetros *= 0.6;
  else if (profundidade > 2.0) baseMetros *= 0.7;
  else if (profundidade > 1.5) baseMetros *= 0.85;

  // Adjust by diameter
  if (diametro > 400) baseMetros *= 0.6;
  else if (diametro > 300) baseMetros *= 0.75;
  else if (diametro > 200) baseMetros *= 0.9;

  // Adjust by equipment
  if (!team.hasRetro) baseMetros *= 0.4;
  if (!team.hasCompactor) baseMetros *= 0.8;
  if (team.hasPump) baseMetros *= 1.1;

  // Adjust by team size
  if (team.oficiais >= 3 && team.ajudantes >= 6) baseMetros *= 1.2;
  else if (team.oficiais < 2 || team.ajudantes < 3) baseMetros *= 0.7;

  return Math.max(3.0, Math.round(baseMetros * 10) / 10);
}

export function getDailyLaborCost(team: TeamConfig, avgCostPerWorker = 180): number {
  const totalWorkers = team.encarregado + team.oficiais + team.ajudantes + team.operador;
  return totalWorkers * avgCostPerWorker;
}

export function getDailyEquipmentCost(team: TeamConfig): number {
  let cost = 0;
  if (team.hasRetro) cost += 450;
  if (team.hasCompactor) cost += 120;
  if (team.hasTruck) cost += 350;
  if (team.hasPump) cost += 200;
  return cost;
}

export function getTotalDailyCost(team: TeamConfig): number {
  return getDailyLaborCost(team) + getDailyEquipmentCost(team);
}

function generateTrechoSchedule(
  trechoId: string,
  comprimento: number,
  profundidade: number,
  diametro: number,
  startDay: number,
  teamNum: number,
  teamConfig: TeamConfig
): DailySegment[] {
  const metrosDia = calculateDailyMeters(profundidade, diametro, teamConfig);
  const numDias = Math.max(1, Math.ceil(comprimento / metrosDia));
  const larguraVala = Math.max(0.6, diametro / 1000 + 0.4);

  const segments: DailySegment[] = [];
  let metrosRestantes = comprimento;

  for (let dia = 0; dia < numDias; dia++) {
    const dayNumber = startDay + dia;
    const metrosHoje = Math.min(metrosDia, metrosRestantes);
    metrosRestantes -= metrosHoje;

    const volEscavacao = metrosHoje * larguraVala * profundidade;
    const volReaterro = volEscavacao * 0.7;

    const activities = [
      "Escavacao",
      "Nivelamento",
      "Assentamento",
      ...(profundidade > 1.25 ? ["Escoramento"] : []),
      ...(teamConfig.hasPump ? ["Bombeamento"] : []),
      "Reaterro",
      "Base/Berco",
    ];

    segments.push({
      segmentId: `${trechoId}.D${dia + 1}`,
      trechoId,
      day: dayNumber,
      meters: metrosHoje,
      team: teamNum,
      activities,
      volEscavacao,
      volReaterro,
      custoTotal: getTotalDailyCost(teamConfig),
    });
  }

  return segments;
}

export function generateCurveSData(
  allSegments: DailySegment[],
  totalDays: number
): CurveSPoint[] {
  const totalMetros = allSegments.reduce((sum, seg) => sum + seg.meters, 0);
  const totalCusto = allSegments.reduce((sum, seg) => sum + seg.custoTotal, 0);

  const points: CurveSPoint[] = [];
  let cumMetros = 0;
  let cumCusto = 0;

  for (let day = 1; day <= totalDays; day++) {
    const daySegments = allSegments.filter((s) => s.day === day);
    cumMetros += daySegments.reduce((sum, s) => sum + s.meters, 0);
    cumCusto += daySegments.reduce((sum, s) => sum + s.custoTotal, 0);

    points.push({
      day,
      physicalPercent: totalMetros > 0 ? (cumMetros / totalMetros) * 100 : 0,
      financialPercent: totalCusto > 0 ? (cumCusto / totalCusto) * 100 : 0,
    });
  }

  return points;
}

export function generateHistogramData(
  allSegments: DailySegment[],
  totalDays: number,
  workersPerTeam: number
): HistogramDay[] {
  const data: HistogramDay[] = [];

  for (let day = 1; day <= totalDays; day++) {
    const daySegments = allSegments.filter((s) => s.day === day && s.team > 0);
    const teamsWorking = new Set(daySegments.map((s) => s.team)).size;

    data.push({
      day,
      labor: teamsWorking * workersPerTeam,
      equipment: teamsWorking,
      cost: daySegments.reduce((sum, s) => sum + s.custoTotal, 0),
    });
  }

  return data;
}

export function generateFullSchedule(
  trechos: Trecho[],
  numEquipes: number,
  teamConfig: TeamConfig,
  dataInicio: Date
): ScheduleResult {
  const teamAvailability = new Array(numEquipes).fill(0);
  const allSegments: DailySegment[] = [];

  for (const trecho of trechos) {
    const teamIdx = teamAvailability.indexOf(Math.min(...teamAvailability));
    const trechoStartDay = teamAvailability[teamIdx] + 1;

    const profundidade = (trecho.cotaInicio - trecho.cotaFim) > 0
      ? Math.abs(trecho.cotaInicio - trecho.cotaFim)
      : 1.5;

    const segments = generateTrechoSchedule(
      `${trecho.idInicio}-${trecho.idFim}`,
      trecho.comprimento,
      Math.max(profundidade, 1.0),
      trecho.diametroMm,
      trechoStartDay,
      teamIdx + 1,
      teamConfig
    );

    const lastDay = Math.max(...segments.map((s) => s.day));
    teamAvailability[teamIdx] = lastDay;

    allSegments.push(...segments);
  }

  const totalDays = allSegments.length > 0 ? Math.max(...allSegments.map((s) => s.day)) : 0;
  const workersPerTeam =
    teamConfig.encarregado + teamConfig.oficiais + teamConfig.ajudantes + teamConfig.operador;

  const curveS = generateCurveSData(allSegments, totalDays);
  const histogram = generateHistogramData(allSegments, totalDays, workersPerTeam);

  const endDate = new Date(dataInicio.getTime() + totalDays * 24 * 60 * 60 * 1000);

  return { allSegments, totalDays, endDate, curveS, histogram };
}
