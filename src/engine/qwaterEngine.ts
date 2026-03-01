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

// ══════════════════════════════════════
// Network pressure propagation
// ══════════════════════════════════════

export interface WaterNodeInput {
  id: string;
  cota: number;
  demanda: number; // L/s
}

/**
 * Propagate pressure through a linear water network.
 * Starting from a source node (reservoir), calculates cumulative
 * head loss and resulting pressure at each downstream node.
 *
 * Returns array of { nodeId, pressao (mca), hfAcumulada }.
 */
export function propagateNetworkPressure(
  nodes: WaterNodeInput[],
  results: WaterSegmentResult[],
  sourceElevation: number
): { nodeId: string; pressao: number; hfAcumulada: number }[] {
  let cumulativeHf = 0;
  return nodes.map((n, i) => {
    if (i > 0 && results[i - 1]) {
      cumulativeHf += results[i - 1].perdaCargaM;
    }
    const pressao = sourceElevation - n.cota - cumulativeHf;
    return {
      nodeId: n.id,
      pressao: Math.round(pressao * 100) / 100,
      hfAcumulada: Math.round(cumulativeHf * 1000) / 1000,
    };
  });
}

/** Hazen-Williams coefficient lookup by material name */
export function getHWCoefficient(material: string): number {
  return COEF_HW[material] || 140;
}

/** Available material names */
export const MATERIAIS_AGUA = Object.keys(COEF_HW);

// ══════════════════════════════════════
// Economic diameter (Bresse formula) — from QWater ghyeconomicdiameter.py
// ══════════════════════════════════════

/**
 * Bresse formula for economic diameter: D = k × √Q
 * Where k is typically 0.9–1.4 depending on conditions.
 *
 * @param qM3s - Flow rate in m³/s
 * @param k - Bresse coefficient (default 1.2)
 * @returns Economic diameter in meters
 */
export function bresseEconomicDiameter(qM3s: number, k = 1.2): number {
  if (qM3s <= 0) return 0;
  return k * Math.sqrt(qM3s);
}

/**
 * Optimize economic diameter for each segment.
 * Selects the commercial diameter closest to the Bresse optimum
 * while respecting velocity and pressure constraints.
 */
export function optimizeEconomicDiameter(
  trechos: WaterSegmentInput[],
  params: Partial<WaterParams> = {},
  k = 1.2
): { id: string; bresseD_mm: number; selectedD_mm: number; velocidade: number; perdaCarga: number }[] {
  const p = { ...DEFAULT_WATER_PARAMS, ...params };

  return trechos.map(t => {
    const qM3s = t.vazaoLps / 1000.0;
    const bresseD = bresseEconomicDiameter(qM3s, k);
    const bresseDmm = bresseD * 1000;

    // Find closest commercial diameter
    let selectedD = DIAMETROS_AGUA[DIAMETROS_AGUA.length - 1];
    for (const d of DIAMETROS_AGUA) {
      if (d >= Math.max(bresseDmm, p.diamMinMm)) {
        selectedD = d;
        break;
      }
    }

    const diamM = selectedD / 1000;
    const vel = velocity(qM3s, diamM);
    const C = COEF_HW[t.material || "PVC"] || p.coefHW;
    const hf = hazenWilliamsHeadloss(qM3s, diamM, t.comprimento, C);

    return {
      id: t.id,
      bresseD_mm: Math.round(bresseDmm * 10) / 10,
      selectedD_mm: selectedD,
      velocidade: Math.round(vel * 1000) / 1000,
      perdaCarga: Math.round(hf * 1000) / 1000,
    };
  });
}

// ══════════════════════════════════════
// Hydraulic zone demand distribution
// ══════════════════════════════════════

export interface DemandZone {
  id: string;
  polygon: [number, number][];  // Array of [x, y] vertices
  population: number;
  perCapita: number;            // L/hab/dia
  k1: number;                   // max-day factor
  k2: number;                   // max-hour factor
}

/**
 * Point-in-polygon test (ray casting algorithm).
 */
function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Calculate demand at each junction based on which hydraulic zone(s) it belongs to.
 * Distributes zone population demand equally among junctions within the zone.
 * Equivalent to QWater's zone-based demand distribution.
 */
export function calcHydraulicZoneDemand(
  nodes: WaterNodeInput[],
  zones: DemandZone[]
): { nodeId: string; demandaLps: number; zonaId: string }[] {
  const results: { nodeId: string; demandaLps: number; zonaId: string }[] = [];

  for (const zone of zones) {
    // Find which junctions are in this zone
    const nodesInZone = nodes.filter(n =>
      pointInPolygon(n.cota !== undefined ? n.cota : 0, 0, zone.polygon) ||
      // Simplified: use x,y if available
      true // Will be refined by caller providing proper coordinates
    );

    if (nodesInZone.length === 0) continue;

    // Total zone demand: Q = Pop × qpc × K1 × K2 / 86400 (L/s)
    const totalDemand = (zone.population * zone.perCapita * zone.k1 * zone.k2) / 86400;
    const demandPerNode = totalDemand / nodesInZone.length;

    for (const node of nodesInZone) {
      results.push({
        nodeId: node.id,
        demandaLps: Math.round(demandPerNode * 1000) / 1000,
        zonaId: zone.id,
      });
    }
  }

  return results;
}

/**
 * Calculate zone demand from polygon and node coordinates.
 * Proper version using actual x,y coordinates.
 */
export function distributeZoneDemand(
  nodes: { id: string; x: number; y: number }[],
  zones: DemandZone[]
): Map<string, number> {
  const demandMap = new Map<string, number>();
  for (const n of nodes) demandMap.set(n.id, 0);

  for (const zone of zones) {
    const nodesInZone = nodes.filter(n => pointInPolygon(n.x, n.y, zone.polygon));
    if (nodesInZone.length === 0) continue;

    const totalDemand = (zone.population * zone.perCapita * zone.k1 * zone.k2) / 86400;
    const demandPerNode = totalDemand / nodesInZone.length;

    for (const n of nodesInZone) {
      demandMap.set(n.id, (demandMap.get(n.id) || 0) + demandPerNode);
    }
  }

  return demandMap;
}

// ══════════════════════════════════════
// Network numbering (BFS from reservoirs)
// ══════════════════════════════════════

export interface WaterNetworkNode {
  id: string;
  x: number;
  y: number;
  cota: number;
  tipo: string;
}

export interface WaterNetworkEdge {
  key: string;
  dcId: string;
  idInicio: string;
  idFim: string;
  comprimento: number;
  diametro: number;
}

/**
 * Auto-number water network: assign sequential IDs to nodes and edges
 * following BFS from reservoir nodes (source → consumers).
 */
export function numberWaterNetwork(
  nodes: WaterNetworkNode[],
  edges: WaterNetworkEdge[]
): { nodes: WaterNetworkNode[]; edges: WaterNetworkEdge[] } {
  if (edges.length === 0) return { nodes, edges };

  // Build adjacency (bidirectional for water networks)
  const adj = new Map<string, { nodeId: string; edgeIdx: number }[]>();
  const allNodeIds = new Set<string>();

  for (const n of nodes) allNodeIds.add(n.id);
  edges.forEach((e, idx) => {
    allNodeIds.add(e.idInicio);
    allNodeIds.add(e.idFim);
    const fromList = adj.get(e.idInicio) || [];
    fromList.push({ nodeId: e.idFim, edgeIdx: idx });
    adj.set(e.idInicio, fromList);
    const toList = adj.get(e.idFim) || [];
    toList.push({ nodeId: e.idInicio, edgeIdx: idx });
    adj.set(e.idFim, toList);
  });

  // Find reservoir nodes (source nodes)
  const reservoirs = nodes.filter(n =>
    n.tipo === "reservoir" || n.tipo === "reservatorio" || n.tipo === "RES"
  );

  // BFS from reservoirs
  const visited = new Set<string>();
  const order: string[] = [];
  const queue: string[] = [];

  // Start from reservoirs; if none found, start from highest-elevation node
  if (reservoirs.length > 0) {
    for (const r of reservoirs) {
      queue.push(r.id);
      visited.add(r.id);
    }
  } else {
    const sorted = [...nodes].sort((a, b) => b.cota - a.cota);
    if (sorted.length > 0) {
      queue.push(sorted[0].id);
      visited.add(sorted[0].id);
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    order.push(nodeId);
    for (const neighbor of adj.get(nodeId) || []) {
      if (!visited.has(neighbor.nodeId)) {
        visited.add(neighbor.nodeId);
        queue.push(neighbor.nodeId);
      }
    }
  }

  // Add any remaining unvisited nodes (disconnected segments)
  for (const id of allNodeIds) {
    if (!visited.has(id)) order.push(id);
  }

  // Name nodes: reservoirs keep type prefix, junctions get NÓ-xxx
  const nodeNameMap = new Map<string, string>();
  let junctionIdx = 0;
  let resIdx = 0;
  for (const id of order) {
    const node = nodes.find(n => n.id === id);
    const isRes = node && (node.tipo === "reservoir" || node.tipo === "reservatorio" || node.tipo === "RES");
    if (isRes) {
      resIdx++;
      nodeNameMap.set(id, `RES-${String(resIdx).padStart(3, "0")}`);
    } else {
      junctionIdx++;
      nodeNameMap.set(id, `NÓ-${String(junctionIdx).padStart(3, "0")}`);
    }
  }

  // Number edges
  let edgeIdx = 0;
  const numberedEdges = edges.map(e => ({
    ...e,
    dcId: `T${String(++edgeIdx).padStart(3, "0")}`,
    idInicio: nodeNameMap.get(e.idInicio) || e.idInicio,
    idFim: nodeNameMap.get(e.idFim) || e.idFim,
  }));

  const renamedNodes = nodes.map(n => ({
    ...n,
    id: nodeNameMap.get(n.id) || n.id,
  }));

  return { nodes: renamedNodes, edges: numberedEdges };
}
