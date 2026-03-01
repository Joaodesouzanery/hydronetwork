/**
 * Elevator Station Engine — Dimensioning and budgeting for sewage/water pump stations.
 *
 * Covers:
 * - Pump sizing: flow rate, TDH (Total Dynamic Head), power
 * - Wet well sizing: volume, dimensions
 * - Budget estimation using SINAPI/SICRO compositions
 * - Timeline generation
 * - NBR 12209 compliance checks
 *
 * References:
 * - NBR 12209: Elaboração de projetos hidráulico-sanitários de estações de tratamento de esgotos sanitários
 * - NBR 12214: Projeto de sistema de bombeamento de água para abastecimento público
 */

const GRAVITY = 9.81;

// ══════════════════════════════════════
// Types
// ══════════════════════════════════════

export interface StationInput {
  /** Station name/ID */
  id: string;
  /** Design flow (L/s) */
  vazaoProjeto: number;
  /** Minimum flow (L/s) */
  vazaoMinima: number;
  /** Maximum flow (L/s) */
  vazaoMaxima: number;
  /** Static suction head - difference between wet well bottom and discharge point (m) */
  alturaGeometrica: number;
  /** Suction pipe length (m) */
  comprimentoSuccao: number;
  /** Discharge pipe length (m) */
  comprimentoRecalque: number;
  /** Suction pipe diameter (mm) */
  diametroSuccao: number;
  /** Discharge pipe diameter (mm) */
  diametroRecalque: number;
  /** Pipe material */
  material: string;
  /** Hazen-Williams coefficient */
  coefHW: number;
  /** Number of pumps (including standby) */
  numBombas: number;
  /** Number of standby pumps */
  numReserva: number;
  /** Pump efficiency (0-1) */
  rendimentoBomba: number;
  /** Motor efficiency (0-1) */
  rendimentoMotor: number;
  /** Station type */
  tipo: "esgoto" | "agua" | "drenagem";
  /** Wet well retention time (minutes) */
  tempoRetencao: number;
}

export interface StationResult {
  id: string;
  /** Total Dynamic Head (m) */
  alturaManometricaTotal: number;
  /** Geometric head (m) */
  alturaGeometrica: number;
  /** Suction head loss (m) */
  perdaCargaSuccao: number;
  /** Discharge head loss (m) */
  perdaCargaRecalque: number;
  /** Local losses (m) - fittings, valves, etc. */
  perdasLocalizadas: number;
  /** Required pump power (kW) */
  potenciaBomba: number;
  /** Required motor power (CV) */
  potenciaMotor: number;
  /** Commercial motor power (CV) */
  potenciaMotorComercial: number;
  /** Wet well volume (m³) */
  volumePocoUmido: number;
  /** Wet well dimensions suggestion */
  dimensoesPocoUmido: { largura: number; comprimento: number; profundidade: number };
  /** Suction velocity (m/s) */
  velocidadeSuccao: number;
  /** Discharge velocity (m/s) */
  velocidadeRecalque: number;
  /** Design flow per pump (L/s) */
  vazaoPorBomba: number;
  /** NBR compliance */
  atendeNorma: boolean;
  /** Warnings/observations */
  observacoes: string[];
  /** Budget estimate */
  orcamento: BudgetItem[];
  /** Timeline items */
  cronograma: TimelineItem[];
}

export interface BudgetItem {
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
  codigoSinapi?: string;
}

export interface TimelineItem {
  etapa: string;
  descricao: string;
  duracaoDias: number;
  dependeDe?: string;
}

// ══════════════════════════════════════
// Hydraulic calculations
// ══════════════════════════════════════

/** Hazen-Williams head loss: hf = 10.643·Q^1.85 / (C^1.85·D^4.87) · L */
function hwHeadloss(qM3s: number, diamM: number, length: number, C: number): number {
  if (qM3s <= 0 || diamM <= 0 || length <= 0 || C <= 0) return 0;
  return 10.643 * Math.pow(qM3s, 1.85) / (Math.pow(C, 1.85) * Math.pow(diamM, 4.87)) * length;
}

/** Flow velocity in pipe: V = Q / A */
function pipeVelocity(qM3s: number, diamM: number): number {
  if (diamM <= 0) return 0;
  const area = Math.PI * diamM * diamM / 4;
  return area > 0 ? qM3s / area : 0;
}

/** Local losses as percentage of linear losses (typical: 10-20%) */
function estimateLocalLosses(linearLoss: number): number {
  return linearLoss * 0.15; // 15% of linear losses
}

/** Commercial motor powers (CV) */
const POTENCIAS_COMERCIAIS = [0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300];

function nextCommercialPower(requiredCV: number): number {
  for (const p of POTENCIAS_COMERCIAIS) {
    if (p >= requiredCV) return p;
  }
  return Math.ceil(requiredCV / 50) * 50;
}

// ══════════════════════════════════════
// Main dimensioning function
// ══════════════════════════════════════

export function dimensionElevatorStation(input: StationInput): StationResult {
  const obs: string[] = [];

  // Active pumps (excluding standby)
  const activePumps = Math.max(input.numBombas - input.numReserva, 1);
  const vazaoPorBomba = input.vazaoProjeto / activePumps;
  const qM3s = input.vazaoProjeto / 1000; // Total flow in m³/s

  // Pipe diameters in meters
  const dSuccaoM = input.diametroSuccao / 1000;
  const dRecalqueM = input.diametroRecalque / 1000;

  // Velocities
  const vSuccao = pipeVelocity(qM3s, dSuccaoM);
  const vRecalque = pipeVelocity(qM3s, dRecalqueM);

  // Velocity checks (NBR 12214)
  if (vSuccao > 1.5) obs.push(`Velocidade de sucção alta: ${vSuccao.toFixed(2)} m/s (máx. 1.5 m/s)`);
  if (vRecalque > 3.0) obs.push(`Velocidade de recalque alta: ${vRecalque.toFixed(2)} m/s (máx. 3.0 m/s)`);
  if (vRecalque < 0.6) obs.push(`Velocidade de recalque baixa: ${vRecalque.toFixed(2)} m/s (mín. 0.6 m/s)`);

  // Head losses
  const hfSuccao = hwHeadloss(qM3s, dSuccaoM, input.comprimentoSuccao, input.coefHW);
  const hfRecalque = hwHeadloss(qM3s, dRecalqueM, input.comprimentoRecalque, input.coefHW);
  const hfLocal = estimateLocalLosses(hfSuccao + hfRecalque);

  // Total Dynamic Head
  const AMT = input.alturaGeometrica + hfSuccao + hfRecalque + hfLocal;

  // Required pump power: P = ρ·g·Q·H / (η_bomba · η_motor)
  const rendTotal = input.rendimentoBomba * input.rendimentoMotor;
  const potenciaKW = (1000 * GRAVITY * qM3s * AMT) / (rendTotal * 1000); // kW
  const potenciaCV = potenciaKW / 0.7355; // Convert kW to CV
  const potenciaMotorComercial = nextCommercialPower(potenciaCV);

  // Wet well volume: V = Q × t_retention
  const volumePocoUmido = (input.vazaoProjeto / 1000) * (input.tempoRetencao * 60); // m³

  // Wet well dimensions (square-ish)
  const profundidade = Math.max(2.5, Math.ceil(Math.sqrt(volumePocoUmido) * 0.8));
  const areaBase = volumePocoUmido / profundidade;
  const lado = Math.ceil(Math.sqrt(areaBase) * 10) / 10;

  // NBR compliance
  let atendeNorma = true;
  if (vSuccao > 1.5) atendeNorma = false;
  if (vRecalque > 3.0) atendeNorma = false;
  if (input.tempoRetencao < 5 && input.tipo === "esgoto") {
    obs.push("Tempo de retenção menor que 5 min para esgoto (NBR 12209 recomenda 5-30 min)");
  }
  if (input.tempoRetencao > 30 && input.tipo === "esgoto") {
    obs.push("Tempo de retenção alto para esgoto: risco de septização (máx. 30 min)");
    atendeNorma = false;
  }
  if (input.numReserva < 1) {
    obs.push("Norma requer pelo menos 1 bomba reserva");
    atendeNorma = false;
  }

  // Budget estimation
  const orcamento = generateBudget(input, AMT, potenciaMotorComercial, volumePocoUmido);

  // Timeline
  const cronograma = generateTimeline(input, volumePocoUmido);

  return {
    id: input.id,
    alturaManometricaTotal: Math.round(AMT * 100) / 100,
    alturaGeometrica: input.alturaGeometrica,
    perdaCargaSuccao: Math.round(hfSuccao * 1000) / 1000,
    perdaCargaRecalque: Math.round(hfRecalque * 1000) / 1000,
    perdasLocalizadas: Math.round(hfLocal * 1000) / 1000,
    potenciaBomba: Math.round(potenciaKW * 100) / 100,
    potenciaMotor: Math.round(potenciaCV * 100) / 100,
    potenciaMotorComercial,
    volumePocoUmido: Math.round(volumePocoUmido * 100) / 100,
    dimensoesPocoUmido: { largura: lado, comprimento: lado, profundidade },
    velocidadeSuccao: Math.round(vSuccao * 1000) / 1000,
    velocidadeRecalque: Math.round(vRecalque * 1000) / 1000,
    vazaoPorBomba: Math.round(vazaoPorBomba * 100) / 100,
    atendeNorma,
    observacoes: obs,
    orcamento,
    cronograma,
  };
}

// ══════════════════════════════════════
// Budget generation (SINAPI-based estimates)
// ══════════════════════════════════════

function generateBudget(
  input: StationInput,
  amt: number,
  potenciaCV: number,
  volumePoco: number
): BudgetItem[] {
  const items: BudgetItem[] = [];

  // Concrete for wet well (m³)
  const concreteVolume = volumePoco * 0.3; // ~30% of volume is structure
  items.push({
    descricao: "Concreto armado fck 30 MPa - poço úmido",
    unidade: "m³",
    quantidade: Math.round(concreteVolume * 10) / 10,
    precoUnitario: 1200,
    precoTotal: Math.round(concreteVolume * 1200),
    codigoSinapi: "96543",
  });

  // Excavation (m³)
  const excavation = volumePoco * 1.5;
  items.push({
    descricao: "Escavação mecanizada em solo",
    unidade: "m³",
    quantidade: Math.round(excavation * 10) / 10,
    precoUnitario: 25,
    precoTotal: Math.round(excavation * 25),
    codigoSinapi: "96396",
  });

  // Pumps
  const pumpPrice = estimatePumpPrice(potenciaCV);
  items.push({
    descricao: `Conjunto motobomba submersível ${potenciaCV} CV (${input.numBombas} un)`,
    unidade: "un",
    quantidade: input.numBombas,
    precoUnitario: pumpPrice,
    precoTotal: pumpPrice * input.numBombas,
    codigoSinapi: "92874",
  });

  // Suction pipe
  items.push({
    descricao: `Tubulação de sucção ${input.material} DN${input.diametroSuccao}`,
    unidade: "m",
    quantidade: input.comprimentoSuccao,
    precoUnitario: estimatePipePrice(input.diametroSuccao),
    precoTotal: Math.round(input.comprimentoSuccao * estimatePipePrice(input.diametroSuccao)),
  });

  // Discharge pipe
  items.push({
    descricao: `Tubulação de recalque ${input.material} DN${input.diametroRecalque}`,
    unidade: "m",
    quantidade: input.comprimentoRecalque,
    precoUnitario: estimatePipePrice(input.diametroRecalque),
    precoTotal: Math.round(input.comprimentoRecalque * estimatePipePrice(input.diametroRecalque)),
  });

  // Valves and fittings
  items.push({
    descricao: "Válvulas, registros e conexões",
    unidade: "vb",
    quantidade: 1,
    precoUnitario: Math.round(pumpPrice * 0.3),
    precoTotal: Math.round(pumpPrice * 0.3),
  });

  // Electrical panel
  const panelPrice = Math.round(1500 + potenciaCV * 120);
  items.push({
    descricao: `Painel elétrico de comando e proteção - ${potenciaCV} CV`,
    unidade: "un",
    quantidade: 1,
    precoUnitario: panelPrice,
    precoTotal: panelPrice,
    codigoSinapi: "97907",
  });

  // Civil works (building, access)
  items.push({
    descricao: "Obras civis complementares (casa de bombas, acesso)",
    unidade: "vb",
    quantidade: 1,
    precoUnitario: Math.round(volumePoco * 800),
    precoTotal: Math.round(volumePoco * 800),
  });

  return items;
}

function estimatePumpPrice(potenciaCV: number): number {
  if (potenciaCV <= 5) return 8000;
  if (potenciaCV <= 15) return 15000;
  if (potenciaCV <= 30) return 25000;
  if (potenciaCV <= 75) return 45000;
  if (potenciaCV <= 150) return 80000;
  return 120000;
}

function estimatePipePrice(diamMm: number): number {
  if (diamMm <= 100) return 45;
  if (diamMm <= 150) return 75;
  if (diamMm <= 200) return 120;
  if (diamMm <= 300) return 200;
  if (diamMm <= 400) return 320;
  return 500;
}

// ══════════════════════════════════════
// Timeline generation
// ══════════════════════════════════════

function generateTimeline(input: StationInput, volumePoco: number): TimelineItem[] {
  const items: TimelineItem[] = [];

  items.push({
    etapa: "1",
    descricao: "Projeto executivo e licenças",
    duracaoDias: 30,
  });

  items.push({
    etapa: "2",
    descricao: "Escavação e contenção",
    duracaoDias: Math.max(7, Math.ceil(volumePoco / 5)),
    dependeDe: "1",
  });

  items.push({
    etapa: "3",
    descricao: "Concretagem do poço úmido",
    duracaoDias: Math.max(14, Math.ceil(volumePoco / 3)),
    dependeDe: "2",
  });

  items.push({
    etapa: "4",
    descricao: "Instalação de tubulações",
    duracaoDias: Math.max(7, Math.ceil((input.comprimentoSuccao + input.comprimentoRecalque) / 50)),
    dependeDe: "3",
  });

  items.push({
    etapa: "5",
    descricao: "Instalação de bombas e quadro elétrico",
    duracaoDias: 10,
    dependeDe: "3",
  });

  items.push({
    etapa: "6",
    descricao: "Obras civis complementares",
    duracaoDias: 15,
    dependeDe: "3",
  });

  items.push({
    etapa: "7",
    descricao: "Comissionamento e testes",
    duracaoDias: 7,
    dependeDe: "5",
  });

  return items;
}

// ══════════════════════════════════════
// Budget summary helpers
// ══════════════════════════════════════

export function getBudgetTotal(items: BudgetItem[]): number {
  return items.reduce((sum, item) => sum + item.precoTotal, 0);
}

export function getTimelineTotal(items: TimelineItem[]): number {
  // Simple serial sum (ignoring parallel tasks)
  return items.reduce((sum, item) => sum + item.duracaoDias, 0);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
