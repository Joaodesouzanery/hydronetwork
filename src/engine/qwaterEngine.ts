/**
 * QWater Engine — Client-side water distribution network dimensioning.
 *
 * NOTE: The original QWater QGIS plugin (jorgealmerio/QWater) delegates
 * ALL hydraulic calculations to EPANET. This engine implements the
 * standard formulas directly for standalone dimensioning.
 *
 * Formulas:
 * - Hazen-Williams: hf = 10.643·Q^1.85 / (C^1.85·D^4.87) · L
 * - Colebrook-White: 1/√f = -2·log10(ε/(3.7·D) + 2.51/(Re·√f))
 *
 * References:
 * - https://github.com/jorgealmerio/QWater
 * - NBR 12218: Projeto de rede de distribuição de água
 */

const PI = Math.PI;
const GRAVITY = 9.81;

// Commercial diameters for water (mm)
const DIAMETROS_AGUA: number[] = [
  32, 40, 50, 63, 75, 85, 100, 110, 125, 150,
  200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000,
];

// Hazen-Williams coefficients per material
const COEF_HW: Record<string, number> = {
  PVC: 150, PEAD: 150, "Ferro Fundido Novo": 130,
  "Ferro Fundido Usado": 100, Concreto: 120, Aço: 120,
};

/** Hazen-Williams head loss: hf = 10.643·Q^1.85 / (C^1.85·D^4.87) · L */
function hazenWilliamsHeadloss(qM3s: number, diamM: number, length: number, C: number): number {
  if (qM3s <= 0 || diamM <= 0 || length <= 0 || C <= 0) return 0;
  return 10.643 * Math.pow(qM3s, 1.85) / (Math.pow(C, 1.85) * Math.pow(diamM, 4.87)) * length;
}

/** Colebrook-White friction factor (iterative) */
function colebrookFrictionFactor(Re: number, epsilon: number, diamM: number): number {
  if (Re <= 0 || diamM <= 0) return 0.02;
  let f = 0.02;
  for (let i = 0; i < 50; i++) {
    const rhs = -2.0 * Math.log10(epsilon / (3.7 * diamM) + 2.51 / (Re * Math.sqrt(f)));
    const fNew = 1.0 / (rhs * rhs);
    if (Math.abs(fNew - f) < 1e-8) break;
    f = fNew;
  }
  return f;
}

/** Darcy-Weisbach head loss: hf = f·L/D·V²/(2g) */
function darcyWeisbachHeadloss(f: number, length: number, diamM: number, vel: number): number {
  if (diamM <= 0) return 0;
  return f * (length / diamM) * (vel * vel) / (2 * GRAVITY);
}

function velocity(qM3s: number, diamM: number): number {
  if (diamM <= 0) return 0;
  const area = PI * diamM * diamM / 4;
  return area > 0 ? qM3s / area : 0;
}

function reynoldsNumber(vel: number, diamM: number, viscosity = 1.01e-6): number {
  return diamM > 0 ? vel * diamM / viscosity : 0;
}

// ══════════════════════════════════════
// Public API
// ══════════════════════════════════════

export interface WaterSegmentInput {
  id: string;
  comprimento: number;
  cotaMontante: number;
  cotaJusante: number;
  vazaoLps: number;
  material?: string;
}

export interface WaterSegmentResult {
  id: string;
  diametroMm: number;
  velocidadeMs: number;
  perdaCargaM: number;
  perdaCargaUnitaria: number;
  pressaoJusante: number | null;
  atendeNorma: boolean;
  observacoes: string[];
}

export interface WaterParams {
  formula: "hazen-williams" | "colebrook";
  coefHW: number;
  velMin: number;
  velMax: number;
  pressaoMin: number;
  pressaoMax: number;
  diamMinMm: number;
  rugosidade: number; // epsilon (mm) for Colebrook
}

const DEFAULT_WATER_PARAMS: WaterParams = {
  formula: "hazen-williams",
  coefHW: 140,
  velMin: 0.6,
  velMax: 3.5,
  pressaoMin: 10.0,
  pressaoMax: 50.0,
  diamMinMm: 50,
  rugosidade: 0.0015, // PVC roughness in mm
};

export function dimensionWaterSegment(
  input: WaterSegmentInput,
  params: Partial<WaterParams> = {}
): WaterSegmentResult {
  const p = { ...DEFAULT_WATER_PARAMS, ...params };
  const obs: string[] = [];
  const qM3s = input.vazaoLps / 1000.0;
  const C = COEF_HW[input.material || "PVC"] || p.coefHW;

  let bestDiam = 0;
  let bestResult: WaterSegmentResult | null = null;

  for (const diamMm of DIAMETROS_AGUA) {
    if (diamMm < p.diamMinMm) continue;
    const diamM = diamMm / 1000.0;
    const vel = velocity(qM3s, diamM);

    let hf: number;
    if (p.formula === "hazen-williams") {
      hf = hazenWilliamsHeadloss(qM3s, diamM, input.comprimento, C);
    } else {
      const Re = reynoldsNumber(vel, diamM);
      const f = colebrookFrictionFactor(Re, p.rugosidade / 1000.0, diamM);
      hf = darcyWeisbachHeadloss(f, input.comprimento, diamM, vel);
    }

    const J = input.comprimento > 0 ? hf / input.comprimento : 0;
    const desnivel = input.cotaMontante - input.cotaJusante;
    const pressaoJusante = desnivel - hf;

    const localObs: string[] = [];
    let atende = true;

    if (vel < p.velMin) { atende = false; localObs.push(`V (${vel.toFixed(2)} m/s) < mín (${p.velMin})`); }
    if (vel > p.velMax) { atende = false; localObs.push(`V (${vel.toFixed(2)} m/s) > máx (${p.velMax})`); }
    if (pressaoJusante < p.pressaoMin) { atende = false; localObs.push(`Pressão (${pressaoJusante.toFixed(1)} mca) < mín (${p.pressaoMin})`); }
    if (pressaoJusante > p.pressaoMax) { localObs.push(`Pressão (${pressaoJusante.toFixed(1)} mca) > máx (${p.pressaoMax})`); }

    const result: WaterSegmentResult = {
      id: input.id,
      diametroMm: diamMm,
      velocidadeMs: Math.round(vel * 1000) / 1000,
      perdaCargaM: Math.round(hf * 1000) / 1000,
      perdaCargaUnitaria: Math.round(J * 100000) / 100000,
      pressaoJusante: Math.round(pressaoJusante * 10) / 10,
      atendeNorma: atende,
      observacoes: localObs,
    };

    if (!bestResult || (atende && !bestResult.atendeNorma)) {
      bestResult = result;
      bestDiam = diamMm;
      if (atende) break; // smallest compliant diameter
    }
  }

  if (!bestResult) {
    return {
      id: input.id,
      diametroMm: DIAMETROS_AGUA[DIAMETROS_AGUA.length - 1],
      velocidadeMs: 0,
      perdaCargaM: 0,
      perdaCargaUnitaria: 0,
      pressaoJusante: null,
      atendeNorma: false,
      observacoes: ["Nenhum diâmetro comercial atende os critérios"],
    };
  }

  return bestResult;
}

export function dimensionWaterNetwork(
  trechos: WaterSegmentInput[],
  params: Partial<WaterParams> = {}
): { resultados: WaterSegmentResult[]; resumo: { total: number; atendem: number; naoAtendem: number } } {
  const resultados = trechos.map(t => dimensionWaterSegment(t, params));
  const atendem = resultados.filter(r => r.atendeNorma).length;
  return {
    resultados,
    resumo: { total: resultados.length, atendem, naoAtendem: resultados.length - atendem },
  };
}
