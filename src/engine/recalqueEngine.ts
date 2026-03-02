/**
 * Recalque (Force Main / Pumping) Engine — Sewage & Water Booster Systems
 *
 * Covers:
 * - Sewage force main (recalque de esgoto) dimensioning
 * - Water booster station dimensioning
 * - Pump selection and system curve generation
 * - NPSH verification
 * - Integration with transient analysis
 *
 * Based on:
 * - NBR 12214:2020 (Projeto de sistemas de bombeamento de água)
 * - NBR 12209 (Estações de tratamento de esgotos)
 * - NBR 12215:2017 (Projeto de adutora de água)
 */

const GRAVITY = 9.81;
const PI = Math.PI;
const WATER_DENSITY = 998.2; // kg/m³

// ══════════════════════════════════════
// Types
// ══════════════════════════════════════

export type RecalqueType = "esgoto" | "agua" | "booster";

export interface RecalqueInput {
  id: string;
  tipo: RecalqueType;
  /** Design flow (L/s) */
  vazaoProjeto: number;
  /** Minimum flow (L/s) */
  vazaoMinima: number;
  /** Maximum flow (L/s) */
  vazaoMaxima: number;
  /** Suction level elevation (m) */
  cotaSuccao: number;
  /** Discharge level elevation (m) */
  cotaDescarga: number;
  /** Suction pipe length (m) */
  comprimentoSuccao: number;
  /** Discharge (force main) pipe length (m) */
  comprimentoRecalque: number;
  /** Suction pipe diameter (mm) */
  diametroSuccao: number;
  /** Discharge pipe diameter (mm) */
  diametroRecalque: number;
  /** Pipe material */
  material: string;
  /** Hazen-Williams coefficient */
  coefHW: number;
  /** Number of pumps (active + standby) */
  numBombas: number;
  /** Number of standby pumps */
  numReserva: number;
  /** Pump efficiency (0-1) */
  rendimentoBomba: number;
  /** Motor efficiency (0-1) */
  rendimentoMotor: number;
  /** Pump rated speed (rpm) */
  rpmBomba: number;
  /** Pump inertia WR² (kg·m²) — for transient analysis */
  inerciaBomba: number;
  /** Has check valve on discharge */
  temValvulaRetencao: boolean;
  /** Valve closure time (s) — for transient analysis */
  tempoFechamentoValvula: number;
  /** Pump curve points [Q (L/s), H (m)] */
  curvaBomba: [number, number][];
  /** Local loss coefficients (K values for fittings) */
  coefPerdaLocalSuccao: number;
  coefPerdaLocalRecalque: number;
  /** NPSH available at suction (m) */
  npshDisponivel?: number;
  /** Atmospheric pressure (mca) — default 10.33 */
  pressaoAtmosferica?: number;
  /** Water temperature (°C) — default 20 */
  temperaturaAgua?: number;
}

export interface RecalqueResult {
  id: string;
  tipo: RecalqueType;
  /** Geometric head (m) */
  alturaGeometrica: number;
  /** Suction head loss (m) */
  perdaCargaSuccao: number;
  /** Discharge head loss (m) */
  perdaCargaRecalque: number;
  /** Local losses suction (m) */
  perdasLocalizadasSuccao: number;
  /** Local losses discharge (m) */
  perdasLocalizadasRecalque: number;
  /** Total Dynamic Head (m) */
  alturaManometricaTotal: number;
  /** Required pump power (kW) */
  potenciaKW: number;
  /** Required motor power (CV) */
  potenciaCV: number;
  /** Commercial motor power (CV) */
  potenciaComercial: number;
  /** Suction velocity (m/s) */
  velocidadeSuccao: number;
  /** Discharge velocity (m/s) */
  velocidadeRecalque: number;
  /** Flow per pump (L/s) */
  vazaoPorBomba: number;
  /** NPSH available (m) */
  npshDisponivel: number;
  /** Pump operating point [Q (L/s), H (m)] */
  pontoOperacao: [number, number];
  /** System curve points [Q (L/s), H (m)] */
  curvaSistema: [number, number][];
  /** Economic diameter by Bresse (mm) */
  diametroBresse: number;
  /** Pipe pressure class needed (PN) */
  classePresao: number;
  /** Compliance with norms */
  atendeNorma: boolean;
  /** Warnings */
  observacoes: string[];
  /** Transient quick analysis */
  transiente: {
    celeridadeOnda: number;
    golpeArieteJoukowsky: number;
    golpeArieteAllievi: number;
    tempoCritico: number;
    pressaoMaxima: number;
    pressaoMinima: number;
    riscoCavitacao: boolean;
    recomendacoes: string[];
  };
}

// ══════════════════════════════════════
// Hydraulic formulas
// ══════════════════════════════════════

/** Hazen-Williams head loss: hf = 10.643·Q^1.85 / (C^1.85·D^4.87) · L */
function hwHeadLoss(qM3s: number, diamM: number, length: number, C: number): number {
  if (qM3s <= 0 || diamM <= 0 || length <= 0 || C <= 0) return 0;
  return 10.643 * Math.pow(qM3s, 1.85) / (Math.pow(C, 1.85) * Math.pow(diamM, 4.87)) * length;
}

/** Pipe flow velocity */
function pipeVelocity(qM3s: number, diamM: number): number {
  if (diamM <= 0) return 0;
  const area = PI * diamM * diamM / 4;
  return area > 0 ? qM3s / area : 0;
}

/** Local head loss: hf_local = K · V² / (2g) */
function localHeadLoss(K: number, velocity: number): number {
  return K * velocity * velocity / (2 * GRAVITY);
}

/** Bresse formula: D = k · √Q (m) */
function bresseDiameter(qM3s: number, k = 1.3): number {
  if (qM3s <= 0) return 0;
  return k * Math.sqrt(qM3s);
}

/** Commercial motor powers (CV) */
const POTENCIAS_COMERCIAIS = [
  0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30,
  40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500,
];

function nextCommercialPower(requiredCV: number): number {
  for (const p of POTENCIAS_COMERCIAIS) {
    if (p >= requiredCV) return p;
  }
  return Math.ceil(requiredCV / 50) * 50;
}

/** Vapor pressure of water by temperature (mca) */
function vaporPressure(tempC: number): number {
  // Antoine equation approximation
  const pvPa = 611.2 * Math.exp((17.67 * tempC) / (tempC + 243.5));
  return pvPa / (WATER_DENSITY * GRAVITY); // Pa → mca
}

/** Local wave speed calculation (avoids circular dependency with transientEngine) */
const WATER_BULK_MODULUS = 2.19e9;
const MATERIAL_YOUNG: Record<string, number> = {
  PVC: 3.0e9, PEAD: 0.8e9, FoFo: 1.0e11, Aco: 2.07e11, Concreto: 2.5e10, PRFV: 1.0e10,
};

function computeWaveSpeedLocal(diamMm: number, wallThickMm: number, material: string): number {
  const E = MATERIAL_YOUNG[material] || 3.0e9;
  const D = diamMm / 1000;
  const e = wallThickMm / 1000;
  if (e <= 0 || D <= 0) return 1000;
  const denom = 1.0 + (WATER_BULK_MODULUS * D) / (E * e);
  return Math.sqrt(WATER_BULK_MODULUS / WATER_DENSITY / denom);
}

/** Pipe pressure class needed (PN bars) */
function pressureClass(maxPressureMca: number): number {
  const pnClasses = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100];
  const maxBar = maxPressureMca / 10.2; // mca → bar
  for (const pn of pnClasses) {
    if (pn >= maxBar * 1.5) return pn; // 1.5x safety factor
  }
  return pnClasses[pnClasses.length - 1];
}

// ══════════════════════════════════════
// Main dimensioning
// ══════════════════════════════════════

export function dimensionRecalque(input: RecalqueInput): RecalqueResult {
  const obs: string[] = [];

  // Active pumps
  const activePumps = Math.max(input.numBombas - input.numReserva, 1);
  const vazaoPorBomba = input.vazaoProjeto / activePumps;
  const qM3s = input.vazaoProjeto / 1000;
  const qBombaM3s = vazaoPorBomba / 1000;

  // Diameters in meters
  const dSuccaoM = input.diametroSuccao / 1000;
  const dRecalqueM = input.diametroRecalque / 1000;

  // Velocities
  const vSuccao = pipeVelocity(qM3s, dSuccaoM);
  const vRecalque = pipeVelocity(qM3s, dRecalqueM);

  // Velocity checks
  if (input.tipo === "esgoto") {
    if (vRecalque < 0.6) obs.push(`V recalque (${vRecalque.toFixed(2)} m/s) abaixo do mínimo 0.6 m/s (esgoto)`);
    if (vRecalque > 3.0) obs.push(`V recalque (${vRecalque.toFixed(2)} m/s) acima do máximo 3.0 m/s`);
    if (vSuccao > 1.5) obs.push(`V sucção (${vSuccao.toFixed(2)} m/s) acima do máximo 1.5 m/s`);
  } else {
    if (vRecalque < 0.5) obs.push(`V recalque (${vRecalque.toFixed(2)} m/s) abaixo do mínimo 0.5 m/s`);
    if (vRecalque > 2.5) obs.push(`V recalque (${vRecalque.toFixed(2)} m/s) acima do máximo 2.5 m/s (NBR 12215)`);
    if (vSuccao > 1.5) obs.push(`V sucção (${vSuccao.toFixed(2)} m/s) acima do máximo 1.5 m/s`);
  }

  // Geometric head
  const Hg = input.cotaDescarga - input.cotaSuccao;
  if (Hg < 0) obs.push("Altura geométrica negativa — verificar cotas");

  // Linear head losses (Hazen-Williams)
  const hfSuccao = hwHeadLoss(qM3s, dSuccaoM, input.comprimentoSuccao, input.coefHW);
  const hfRecalque = hwHeadLoss(qM3s, dRecalqueM, input.comprimentoRecalque, input.coefHW);

  // Local losses
  const hlSuccao = localHeadLoss(input.coefPerdaLocalSuccao, vSuccao);
  const hlRecalque = localHeadLoss(input.coefPerdaLocalRecalque, vRecalque);

  // Total Dynamic Head
  const AMT = Math.abs(Hg) + hfSuccao + hfRecalque + hlSuccao + hlRecalque;

  // Power calculation
  const rendTotal = input.rendimentoBomba * input.rendimentoMotor;
  const potKW = (WATER_DENSITY * GRAVITY * qM3s * AMT) / (rendTotal * 1000);
  const potCV = potKW / 0.7355;
  const potenciaComercial = nextCommercialPower(potCV);

  // NPSH calculation
  const patm = input.pressaoAtmosferica ?? 10.33;
  const temp = input.temperaturaAgua ?? 20;
  const pv = vaporPressure(temp);
  const hSuccaoGeom = Math.max(0, input.cotaSuccao); // height of suction
  const npshDisp = patm - pv - hfSuccao - hlSuccao - hSuccaoGeom;

  if (npshDisp < 2.0) {
    obs.push(`NPSH disponível (${npshDisp.toFixed(2)} m) muito baixo — risco de cavitação na bomba`);
  }

  // Bresse economic diameter
  const dBresse = bresseDiameter(qM3s);
  const dBresseMm = Math.round(dBresse * 1000);

  // System curve generation
  const curvaSistema = generateSystemCurve(
    Hg, input.comprimentoSuccao, input.comprimentoRecalque,
    dSuccaoM, dRecalqueM, input.coefHW,
    input.coefPerdaLocalSuccao, input.coefPerdaLocalRecalque,
  );

  // Find operating point (intersection of pump curve and system curve)
  const pontoOperacao = findOperatingPoint(input.curvaBomba, curvaSistema);

  // Transient quick analysis
  const mat = (input.material as any) || "PVC";
  const wallThick = estimateWallThickness(mat);
  const celeridade = computeWaveSpeedLocal(input.diametroRecalque, wallThick, mat);
  const golpeJoukowsky = (celeridade * Math.abs(vRecalque)) / GRAVITY;
  const tempoCritico = (2 * input.comprimentoRecalque) / celeridade;
  const closureTime = input.tempoFechamentoValvula || tempoCritico * 2;
  const golpeAllievi = closureTime <= tempoCritico
    ? golpeJoukowsky
    : golpeJoukowsky * (tempoCritico / closureTime);

  const pMax = AMT + golpeAllievi;
  const pMin = AMT - golpeAllievi;
  const riscoCav = pMin < 0;
  const recsTransiente: string[] = [];

  if (riscoCav) {
    recsTransiente.push("RISCO DE CAVITAÇÃO: pressão mínima negativa. Instale ventosa ou câmara de ar.");
  }
  if (closureTime < tempoCritico) {
    recsTransiente.push(`Fechamento RÁPIDO (${closureTime.toFixed(1)}s < Tc=${tempoCritico.toFixed(1)}s).`);
  }
  if (golpeJoukowsky > AMT * 0.3) {
    recsTransiente.push("Golpe de aríete > 30% do AMT. Considere proteção antitransiente.");
  }
  if (input.diametroRecalque >= 300) {
    recsTransiente.push("CAESB/SABESP: DN ≥ 300mm requer simulação completa (MOC) de transientes.");
  }

  // Pressure class
  const classeP = pressureClass(pMax);

  // Compliance
  let atendeNorma = true;
  if (input.tipo === "esgoto") {
    if (vRecalque < 0.6 || vRecalque > 3.0) atendeNorma = false;
    if (input.numReserva < 1) {
      obs.push("NBR 12209: necessária pelo menos 1 bomba reserva para esgoto");
      atendeNorma = false;
    }
  } else {
    if (vRecalque < 0.5 || vRecalque > 2.5) atendeNorma = false;
  }
  if (vSuccao > 1.5) atendeNorma = false;
  if (riscoCav) {
    atendeNorma = false;
    obs.push("Não atende: risco de cavitação por golpe de aríete");
  }

  return {
    id: input.id,
    tipo: input.tipo,
    alturaGeometrica: Math.round(Math.abs(Hg) * 100) / 100,
    perdaCargaSuccao: Math.round(hfSuccao * 1000) / 1000,
    perdaCargaRecalque: Math.round(hfRecalque * 1000) / 1000,
    perdasLocalizadasSuccao: Math.round(hlSuccao * 1000) / 1000,
    perdasLocalizadasRecalque: Math.round(hlRecalque * 1000) / 1000,
    alturaManometricaTotal: Math.round(AMT * 100) / 100,
    potenciaKW: Math.round(potKW * 100) / 100,
    potenciaCV: Math.round(potCV * 100) / 100,
    potenciaComercial,
    velocidadeSuccao: Math.round(vSuccao * 1000) / 1000,
    velocidadeRecalque: Math.round(vRecalque * 1000) / 1000,
    vazaoPorBomba: Math.round(vazaoPorBomba * 100) / 100,
    npshDisponivel: Math.round(npshDisp * 100) / 100,
    pontoOperacao,
    curvaSistema,
    diametroBresse: dBresseMm,
    classePresao: classeP,
    atendeNorma,
    observacoes: obs,
    transiente: {
      celeridadeOnda: Math.round(celeridade * 10) / 10,
      golpeArieteJoukowsky: Math.round(golpeJoukowsky * 100) / 100,
      golpeArieteAllievi: Math.round(golpeAllievi * 100) / 100,
      tempoCritico: Math.round(tempoCritico * 100) / 100,
      pressaoMaxima: Math.round(pMax * 100) / 100,
      pressaoMinima: Math.round(pMin * 100) / 100,
      riscoCavitacao: riscoCav,
      recomendacoes: recsTransiente,
    },
  };
}

// ══════════════════════════════════════
// System curve generation
// ══════════════════════════════════════

function generateSystemCurve(
  Hg: number,
  lenSuccao: number,
  lenRecalque: number,
  dSuccaoM: number,
  dRecalqueM: number,
  C: number,
  kLocalSuccao: number,
  kLocalRecalque: number,
): [number, number][] {
  const points: [number, number][] = [];
  const maxFlow = 200; // L/s max for curve
  const steps = 50;

  for (let i = 0; i <= steps; i++) {
    const qLps = (i / steps) * maxFlow;
    const qM3s = qLps / 1000;

    const hfS = hwHeadLoss(qM3s, dSuccaoM, lenSuccao, C);
    const hfR = hwHeadLoss(qM3s, dRecalqueM, lenRecalque, C);
    const vS = pipeVelocity(qM3s, dSuccaoM);
    const vR = pipeVelocity(qM3s, dRecalqueM);
    const hlS = localHeadLoss(kLocalSuccao, vS);
    const hlR = localHeadLoss(kLocalRecalque, vR);

    const H = Math.abs(Hg) + hfS + hfR + hlS + hlR;
    points.push([Math.round(qLps * 100) / 100, Math.round(H * 100) / 100]);
  }

  return points;
}

// ══════════════════════════════════════
// Operating point finder
// ══════════════════════════════════════

function findOperatingPoint(
  pumpCurve: [number, number][],
  systemCurve: [number, number][],
): [number, number] {
  if (pumpCurve.length < 2 || systemCurve.length < 2) {
    return [0, 0];
  }

  // Interpolate both curves and find intersection
  let bestQ = 0;
  let bestH = 0;
  let minDiff = Infinity;

  for (const [qSys, hSys] of systemCurve) {
    // Interpolate pump curve at this flow
    const hPump = interpolateCurve(pumpCurve, qSys);
    if (hPump === null) continue;

    const diff = Math.abs(hPump - hSys);
    if (diff < minDiff) {
      minDiff = diff;
      bestQ = qSys;
      bestH = (hPump + hSys) / 2;
    }
  }

  return [Math.round(bestQ * 100) / 100, Math.round(bestH * 100) / 100];
}

function interpolateCurve(curve: [number, number][], x: number): number | null {
  if (curve.length === 0) return null;
  if (x <= curve[0][0]) return curve[0][1];
  if (x >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];

  for (let i = 0; i < curve.length - 1; i++) {
    if (x >= curve[i][0] && x <= curve[i + 1][0]) {
      const t = (x - curve[i][0]) / (curve[i + 1][0] - curve[i][0]);
      return curve[i][1] + t * (curve[i + 1][1] - curve[i][1]);
    }
  }
  return null;
}

function estimateWallThickness(material: string): number {
  switch (material) {
    case "PVC": return 5;
    case "PEAD": return 8;
    case "FoFo": return 10;
    case "Aco": return 6;
    case "Concreto": return 40;
    case "PRFV": return 6;
    default: return 5;
  }
}

// ══════════════════════════════════════
// Booster station specific
// ══════════════════════════════════════

export interface BoosterInput {
  id: string;
  /** Incoming pressure (mca) */
  pressaoEntrada: number;
  /** Required outlet pressure (mca) */
  pressaoSaida: number;
  /** Design flow (L/s) */
  vazao: number;
  /** Pipe diameter (mm) */
  diametro: number;
  /** Pipe length through booster (m) */
  comprimento: number;
  /** Material */
  material: string;
  /** HW coefficient */
  coefHW: number;
  /** Number of pumps */
  numBombas: number;
  /** Pump efficiency */
  rendimento: number;
}

export interface BoosterResult {
  id: string;
  /** Required boost head (m) */
  alturaBoost: number;
  /** Pump power (kW) */
  potenciaKW: number;
  /** Commercial motor power (CV) */
  potenciaComercial: number;
  /** Outlet velocity (m/s) */
  velocidade: number;
  /** Head loss in booster piping (m) */
  perdaCarga: number;
  /** Compliance */
  atendeNorma: boolean;
  /** Observations */
  observacoes: string[];
}

export function dimensionBooster(input: BoosterInput): BoosterResult {
  const obs: string[] = [];
  const qM3s = input.vazao / 1000;
  const dM = input.diametro / 1000;
  const V = pipeVelocity(qM3s, dM);
  const hf = hwHeadLoss(qM3s, dM, input.comprimento, input.coefHW);

  const boostHead = Math.max(0, input.pressaoSaida - input.pressaoEntrada + hf);

  if (boostHead <= 0) {
    obs.push("Pressão de entrada já é suficiente — booster não necessário");
  }

  const potKW = (WATER_DENSITY * GRAVITY * qM3s * boostHead) / (input.rendimento * 1000);
  const potCV = potKW / 0.7355;
  const potenciaComercial = nextCommercialPower(potCV / input.numBombas);

  if (V > 2.5) obs.push(`Velocidade alta: ${V.toFixed(2)} m/s (máx. 2.5 m/s)`);
  if (V < 0.5) obs.push(`Velocidade baixa: ${V.toFixed(2)} m/s (mín. 0.5 m/s)`);

  let atendeNorma = true;
  if (V > 2.5 || V < 0.5) atendeNorma = false;
  if (input.pressaoSaida > 50) {
    obs.push("Pressão de saída > 50 mca — verificar limites da NBR 12218");
    atendeNorma = false;
  }

  return {
    id: input.id,
    alturaBoost: Math.round(boostHead * 100) / 100,
    potenciaKW: Math.round(potKW * 100) / 100,
    potenciaComercial,
    velocidade: Math.round(V * 1000) / 1000,
    perdaCarga: Math.round(hf * 1000) / 1000,
    atendeNorma,
    observacoes: obs,
  };
}

// ══════════════════════════════════════
// Report generation
// ══════════════════════════════════════

export function generateRecalqueReport(result: RecalqueResult): string {
  const tipoLabel = result.tipo === "esgoto" ? "Esgoto" : result.tipo === "booster" ? "Booster" : "Água";
  return `
╔══════════════════════════════════════════════════════╗
║         DIMENSIONAMENTO DE RECALQUE — ${tipoLabel.padEnd(12)}    ║
╠══════════════════════════════════════════════════════╣
║ DADOS GEOMÉTRICOS                                    ║
║ Altura Geométrica:     ${(result.alturaGeometrica + " m").padEnd(28)} ║
║ AMT:                   ${(result.alturaManometricaTotal + " m").padEnd(28)} ║
║ Perda Sucção:          ${(result.perdaCargaSuccao + " m").padEnd(28)} ║
║ Perda Recalque:        ${(result.perdaCargaRecalque + " m").padEnd(28)} ║
║ Perdas Localizadas:    ${((result.perdasLocalizadasSuccao + result.perdasLocalizadasRecalque).toFixed(3) + " m").padEnd(28)} ║
╠══════════════════════════════════════════════════════╣
║ BOMBEAMENTO                                          ║
║ Potência Bomba:        ${(result.potenciaKW + " kW").padEnd(28)} ║
║ Potência Motor:        ${(result.potenciaCV + " CV").padEnd(28)} ║
║ Potência Comercial:    ${(result.potenciaComercial + " CV").padEnd(28)} ║
║ Vazão/Bomba:           ${(result.vazaoPorBomba + " L/s").padEnd(28)} ║
║ NPSH Disponível:       ${(result.npshDisponivel + " m").padEnd(28)} ║
╠══════════════════════════════════════════════════════╣
║ TRANSIENTES HIDRÁULICOS                              ║
║ Celeridade (a):        ${(result.transiente.celeridadeOnda + " m/s").padEnd(28)} ║
║ Golpe Joukowsky:       ${(result.transiente.golpeArieteJoukowsky + " m").padEnd(28)} ║
║ Golpe Allievi:         ${(result.transiente.golpeArieteAllievi + " m").padEnd(28)} ║
║ Tempo Crítico:         ${(result.transiente.tempoCritico + " s").padEnd(28)} ║
║ Pressão Máxima:        ${(result.transiente.pressaoMaxima + " mca").padEnd(28)} ║
║ Pressão Mínima:        ${(result.transiente.pressaoMinima + " mca").padEnd(28)} ║
║ Classe Pressão:        ${"PN " + result.classePresao}                             ║
║ Cavitação:             ${(result.transiente.riscoCavitacao ? "SIM ⚠" : "NÃO ✓").padEnd(28)} ║
╠══════════════════════════════════════════════════════╣
║ Status:                ${(result.atendeNorma ? "ATENDE NORMA ✓" : "NÃO ATENDE ✗").padEnd(28)} ║
╚══════════════════════════════════════════════════════╝
`.trim();
}
