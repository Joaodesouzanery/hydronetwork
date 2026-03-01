/**
 * QEsg Engine — Client-side sewer network dimensioning.
 *
 * Faithful port of jorgealmerio/QEsg (QGIS plugin) core formulas.
 * Based on Brazilian standards NBR 9649 and NBR 14486.
 *
 * Key formulas from QEsg_03Dimensionamento.py:
 * - CalcDiametro: D = [n·Q / (√I·(A/D²)·(Rh/D)^(2/3))]^(3/8) × 1000
 * - CalcTheta: binary search with M threshold 0.335282
 * - Tensão trativa: τ = 10000·Rh·I (Pa)
 * - Velocidade crítica: v_c = 6·√(g·Rh)
 * - Declividade mínima: I_min = 0.0055·Q^(-0.47)
 *
 * References:
 * - https://github.com/jorgealmerio/QEsg
 * - NBR 9649: Projeto de redes coletoras de esgoto sanitário
 * - Ariovaldo Nuvolari, "Esgoto sanitário"
 */

// Commercial pipe diameters: [diameter_mm, manning_n]
const TUBOS_PVC: [number, number][] = [
  [100, 0.013], [150, 0.013], [200, 0.013], [250, 0.013],
  [300, 0.013], [350, 0.013], [400, 0.013], [450, 0.013],
  [500, 0.013], [600, 0.013], [700, 0.013], [800, 0.013],
  [900, 0.013], [1000, 0.013], [1200, 0.013], [1500, 0.013],
];

const TUBOS_CONCRETO: [number, number][] = [
  [300, 0.015], [400, 0.015], [500, 0.015], [600, 0.015],
  [700, 0.015], [800, 0.015], [900, 0.015], [1000, 0.015],
  [1200, 0.015], [1500, 0.015], [2000, 0.015],
];

/** Central angle θ from y/D ratio: θ = 2·arccos(1 - 2·y/D) */
function thetaFromYd(yd: number): number {
  yd = Math.min(Math.max(yd, 0.001), 0.999);
  return 2.0 * Math.acos(1.0 - 2.0 * yd);
}

/** y/D from central angle θ: y/D = 0.5·(1 - cos(θ/2)) */
function ydFromTheta(theta: number): number {
  return 0.5 * (1.0 - Math.cos(theta / 2.0));
}

/** Normalized area A/D² = (θ - sin θ) / 8 */
function calcAreaNormalized(theta: number): number {
  return (theta - Math.sin(theta)) / 8.0;
}

/** Normalized hydraulic radius Rh/D = (θ - sin θ) / (4θ) */
function calcRhNormalized(theta: number): number {
  if (theta <= 0) return 0;
  return (theta - Math.sin(theta)) / (4.0 * theta);
}

/** Manning velocity: V = (1/n) · Rh^(2/3) · S^(1/2) */
function manningVelocity(rh: number, slope: number, n: number): number {
  if (slope <= 0 || rh <= 0) return 0;
  return (1.0 / n) * Math.pow(rh, 2.0 / 3.0) * Math.pow(slope, 0.5);
}

/** Tractive stress: τ = 10000 · Rh · I (Pa) — QEsg formula */
function calcTractiveStress(rh: number, slope: number): number {
  return 10000.0 * rh * slope;
}

/** Critical velocity: v_c = 6·√(g·Rh) */
function calcCriticalVelocity(rh: number): number {
  if (rh <= 0) return 0;
  return 6.0 * Math.sqrt(9.81 * rh);
}

/** Minimum slope: I_min = 0.0055·Q^(-0.47) */
function calcMinSlope(vazaoLps: number): number {
  if (vazaoLps <= 0) return 0.005;
  return 0.0055 * Math.pow(vazaoLps, -0.47);
}

/** Analytical diameter: D = [n·Q/(√I·(A/D²)·(Rh/D)^(2/3))]^(3/8) × 1000 */
function calcDiameterAnalytical(qLps: number, n: number, slope: number, yd: number): number {
  if (slope <= 0 || qLps <= 0) return 0;
  const qM3s = qLps / 1000.0;
  const theta = thetaFromYd(yd);
  const amD2 = calcAreaNormalized(theta);
  const rhD = calcRhNormalized(theta);
  if (amD2 <= 0 || rhD <= 0) return 0;
  const diamM = Math.pow(n * qM3s / (Math.pow(slope, 0.5) * amD2 * Math.pow(rhD, 2.0 / 3.0)), 3.0 / 8.0);
  return diamM * 1000.0;
}

/**
 * Find θ (central angle) for given flow conditions.
 * Binary search with M = n·Q/(√I·D^(8/3)), threshold 0.335282.
 */
function calcThetaForFlow(qLps: number, n: number, slope: number, diamMm: number): number {
  if (slope <= 0 || diamMm <= 0) return 0;
  const diamM = diamMm / 1000.0;
  const qM3s = qLps / 1000.0;
  const M = n * qM3s / (Math.pow(slope, 0.5) * Math.pow(diamM, 8.0 / 3.0));

  if (M >= 0.335282) return 2.0 * Math.PI;

  let thetaLow = 0.01;
  let thetaHigh = 2.0 * Math.PI;
  let theta = Math.PI;

  for (let i = 0; i < 1000; i++) {
    const amD2 = calcAreaNormalized(theta);
    const rhD = calcRhNormalized(theta);
    if (rhD <= 0) { thetaLow = theta; theta = (thetaLow + thetaHigh) / 2; continue; }
    const mCalc = amD2 * Math.pow(rhD, 2.0 / 3.0);
    if (Math.abs(mCalc - M) < 1e-10) break;
    if (mCalc < M) thetaLow = theta; else thetaHigh = theta;
    theta = (thetaLow + thetaHigh) / 2;
  }
  return theta;
}

function selectCommercialDiameter(diamCalcMm: number, diamMinMm: number, tubos: [number, number][]): [number, number] {
  for (const [d, n] of tubos) {
    if (d >= Math.max(diamCalcMm, diamMinMm)) return [d, n];
  }
  const last = tubos[tubos.length - 1];
  return [last[0], last[1]];
}

// ══════════════════════════════════════
// Public API
// ══════════════════════════════════════

export interface SewerSegmentInput {
  id: string;
  comprimento: number;
  cotaMontante: number;
  cotaJusante: number;
  vazaoLps: number;
  tipoTubo?: string;
}

export interface SewerSegmentResult {
  id: string;
  diametroMm: number;
  diametroCalculadoMm: number;
  declividadeMin: number;
  declividadeUsada: number;
  velocidadeMs: number;
  velocidadeCriticaMs: number;
  laminaDagua: number;
  tensaoTrativa: number;
  atendeNorma: boolean;
  observacoes: string[];
}

export interface SewerParams {
  manning: number;
  laminaMax: number;
  velMin: number;
  velMax: number;
  tensaoMin: number;
  diamMinMm: number;
}

const DEFAULT_SEWER_PARAMS: SewerParams = {
  manning: 0.013,
  laminaMax: 0.75,
  velMin: 0.6,
  velMax: 5.0,
  tensaoMin: 1.0,
  diamMinMm: 150,
};

export function dimensionSewerSegment(
  input: SewerSegmentInput,
  params: Partial<SewerParams> = {}
): SewerSegmentResult {
  const p = { ...DEFAULT_SEWER_PARAMS, ...params };
  const obs: string[] = [];

  let slope = input.comprimento > 0
    ? (input.cotaMontante - input.cotaJusante) / input.comprimento
    : 0;

  if (slope < 0) {
    obs.push("Declividade negativa (contra-fluxo) - usando valor absoluto");
    slope = Math.abs(slope);
  }
  if (slope === 0) {
    obs.push("Declividade nula - usando declividade mínima");
    slope = calcMinSlope(input.vazaoLps);
  }

  const iMin = calcMinSlope(input.vazaoLps);
  const slopeUsed = Math.max(slope, iMin);
  if (slope < iMin) {
    obs.push(`Declividade (${slope.toFixed(6)}) abaixo da mínima (${iMin.toFixed(6)})`);
  }

  const tubos = (input.tipoTubo || "PVC").toUpperCase().includes("CONCRETO") ? TUBOS_CONCRETO : TUBOS_PVC;
  const diamCalc = calcDiameterAnalytical(input.vazaoLps, p.manning, slopeUsed, p.laminaMax);
  const [diamMm, nTubo] = selectCommercialDiameter(diamCalc, p.diamMinMm, tubos);
  const diamM = diamMm / 1000.0;

  const theta = calcThetaForFlow(input.vazaoLps, nTubo, slopeUsed, diamMm);
  const yd = ydFromTheta(theta);
  const amD2 = calcAreaNormalized(theta);
  const rhD = calcRhNormalized(theta);
  const area = amD2 * diamM * diamM;
  const rh = rhD * diamM;
  const vel = area > 0 ? (input.vazaoLps / 1000.0) / area : 0;
  const tensao = calcTractiveStress(rh, slopeUsed);
  const vCrit = calcCriticalVelocity(rh);

  let atende = true;
  if (yd > p.laminaMax) { atende = false; obs.push(`y/D (${yd.toFixed(3)}) excede máximo (${p.laminaMax})`); }
  if (vel < p.velMin) { atende = false; obs.push(`Velocidade (${vel.toFixed(3)} m/s) abaixo do mínimo (${p.velMin} m/s)`); }
  if (vel > p.velMax) { atende = false; obs.push(`Velocidade (${vel.toFixed(3)} m/s) acima do máximo (${p.velMax} m/s)`); }
  if (tensao < p.tensaoMin) { atende = false; obs.push(`Tensão trativa (${tensao.toFixed(3)} Pa) abaixo do mínimo (${p.tensaoMin} Pa)`); }
  if (vel > vCrit && yd > 0.5) { obs.push(`V > V_crítica (${vCrit.toFixed(2)} m/s) → y/D deveria ser ≤ 0.50`); }

  return {
    id: input.id,
    diametroMm: diamMm,
    diametroCalculadoMm: Math.round(diamCalc * 10) / 10,
    declividadeMin: Math.round(iMin * 1e6) / 1e6,
    declividadeUsada: Math.round(slopeUsed * 1e6) / 1e6,
    velocidadeMs: Math.round(vel * 1000) / 1000,
    velocidadeCriticaMs: Math.round(vCrit * 1000) / 1000,
    laminaDagua: Math.round(yd * 10000) / 10000,
    tensaoTrativa: Math.round(tensao * 1000) / 1000,
    atendeNorma: atende,
    observacoes: obs,
  };
}

export function dimensionSewerNetwork(
  trechos: SewerSegmentInput[],
  params: Partial<SewerParams> = {}
): { resultados: SewerSegmentResult[]; resumo: { total: number; atendem: number; naoAtendem: number } } {
  const resultados = trechos.map(t => dimensionSewerSegment(t, params));
  const atendem = resultados.filter(r => r.atendeNorma).length;
  return {
    resultados,
    resumo: { total: resultados.length, atendem, naoAtendem: resultados.length - atendem },
  };
}

// ══════════════════════════════════════
// Network topology utilities
// ══════════════════════════════════════

export interface SewerNodeInput {
  id: string;
  vazaoLocal: number; // L/s contribution at this node
}

/**
 * Accumulate sewer flow through the network topology.
 *
 * For a linear series of segments A→B→C, segment B→C carries the flow
 * from A→B plus the local contribution at B.
 *
 * For branched networks, each segment's flow equals the sum of all
 * upstream local contributions (topological sort).
 */
export function accumulateSewerFlow(
  trechos: SewerSegmentInput[],
  nodeFlows: SewerNodeInput[]
): SewerSegmentInput[] {
  const flowMap = new Map<string, number>();
  for (const nf of nodeFlows) flowMap.set(nf.id, nf.vazaoLocal);

  // Build adjacency: downstream[nodeId] = list of segment indices leaving this node
  // Each segment goes from node "upstream" to node "downstream"
  // We extract node IDs from segment IDs formatted as "from-to"
  const segmentNodes = trechos.map(t => {
    const parts = t.id.split("-");
    // Handle IDs that themselves contain dashes (e.g. "PV-1-PV-2")
    const mid = Math.floor(parts.length / 2);
    return { from: parts.slice(0, mid).join("-"), to: parts.slice(mid).join("-") };
  });

  // Build in-degree and upstream map
  const inDegree = new Map<string, number>();
  const upstreamOf = new Map<string, number[]>(); // nodeId → segment indices that feed INTO it
  const downstreamOf = new Map<string, number[]>(); // nodeId → segment indices that leave it
  const allNodes = new Set<string>();

  segmentNodes.forEach((sn, i) => {
    allNodes.add(sn.from);
    allNodes.add(sn.to);
    inDegree.set(sn.to, (inDegree.get(sn.to) || 0) + 1);
    if (!inDegree.has(sn.from)) inDegree.set(sn.from, 0);
    const up = upstreamOf.get(sn.to) || [];
    up.push(i);
    upstreamOf.set(sn.to, up);
    const dn = downstreamOf.get(sn.from) || [];
    dn.push(i);
    downstreamOf.set(sn.from, dn);
  });

  // Topological sort (Kahn's algorithm)
  const queue: string[] = [];
  for (const [node, deg] of inDegree) {
    if (deg === 0) queue.push(node);
  }

  // Accumulated flow arriving at each node
  const nodeAccum = new Map<string, number>();
  for (const n of allNodes) nodeAccum.set(n, flowMap.get(n) || 0);

  const segmentFlows = new Array<number>(trechos.length).fill(0);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const accum = nodeAccum.get(node) || 0;

    // Propagate to downstream segments
    const downSegs = downstreamOf.get(node) || [];
    for (const si of downSegs) {
      segmentFlows[si] = accum;
      const toNode = segmentNodes[si].to;
      nodeAccum.set(toNode, (nodeAccum.get(toNode) || 0) + accum);
      inDegree.set(toNode, (inDegree.get(toNode) || 0) - 1);
      if ((inDegree.get(toNode) || 0) <= 0) queue.push(toNode);
    }
  }

  return trechos.map((t, i) => ({
    ...t,
    vazaoLps: Math.max(segmentFlows[i], t.vazaoLps), // never less than input
  }));
}

/** PV (poço de visita) depth calculation */
export function calcPVDepth(cotaTerreno: number, cotaFundo: number): number {
  return cotaTerreno - cotaFundo;
}

/** Population-based flow: Q = Pop × qpc × K1 × K2 / 86400 (L/s) */
export function calcPopulationFlow(
  populacao: number,
  qpcLitrosDia: number,
  k1 = 1.2,
  k2 = 1.5
): number {
  return (populacao * qpcLitrosDia * k1 * k2) / 86400;
}

// ══════════════════════════════════════
// Network numbering utilities (QEsg Button 01-02)
// ══════════════════════════════════════

export interface SewerNetworkNode {
  id: string;
  x: number;
  y: number;
  cotaTerreno: number;
  cotaFundo: number;
}

export interface SewerNetworkEdge {
  key: string;
  dcId: string;
  idInicio: string;
  idFim: string;
  comprimento: number;
  cotaTerrenoM: number;
  cotaTerrenoJ: number;
  cotaColetorM: number;
  cotaColetorJ: number;
  manning: number;
  diametro: number;
  declividade: number;
}

/**
 * Auto-number sewer network: assign sequential DC_IDs to edges
 * and PV names to nodes following topological order (upstream → downstream).
 * Equivalent to QEsg Buttons 01 (Sketching) and 02 (Sketching Names).
 */
export function numberSewerNetwork(
  nodes: SewerNetworkNode[],
  edges: SewerNetworkEdge[]
): { nodes: SewerNetworkNode[]; edges: SewerNetworkEdge[] } {
  if (edges.length === 0) return { nodes, edges };

  // Build adjacency: find head nodes (in-degree = 0)
  const inDegree = new Map<string, number>();
  const downstream = new Map<string, string[]>();
  const allNodeIds = new Set<string>();

  for (const e of edges) {
    allNodeIds.add(e.idInicio);
    allNodeIds.add(e.idFim);
    inDegree.set(e.idFim, (inDegree.get(e.idFim) || 0) + 1);
    if (!inDegree.has(e.idInicio)) inDegree.set(e.idInicio, 0);
    const ds = downstream.get(e.idInicio) || [];
    ds.push(e.idFim);
    downstream.set(e.idInicio, ds);
  }

  // Topological sort
  const queue: string[] = [];
  for (const [n, d] of inDegree) if (d === 0) queue.push(n);
  const order: string[] = [];
  const deg = new Map(inDegree);

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const next of downstream.get(node) || []) {
      deg.set(next, (deg.get(next) || 1) - 1);
      if ((deg.get(next) || 0) <= 0) queue.push(next);
    }
  }

  // Name nodes as PV-001, PV-002... in topological order
  const nodeNameMap = new Map<string, string>();
  order.forEach((id, i) => {
    nodeNameMap.set(id, `PV-${String(i + 1).padStart(3, "0")}`);
  });

  // Number edges
  const edgeMap = new Map(edges.map(e => [`${e.idInicio}-${e.idFim}`, e]));
  let edgeIdx = 0;
  const numberedEdges = edges.map(e => ({
    ...e,
    dcId: `C${String(++edgeIdx).padStart(3, "0")}`,
  }));

  return { nodes, edges: numberedEdges };
}

/**
 * Fill segment fields from node data (QEsg Button 04 equivalent).
 * Transfers terrain elevations from nodes to upstream/downstream segment fields.
 */
export function fillFieldsFromNodes(
  nodes: SewerNetworkNode[],
  edges: SewerNetworkEdge[],
  defaultDepth = 1.5
): SewerNetworkEdge[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return edges.map(e => {
    const fromNode = nodeMap.get(e.idInicio);
    const toNode = nodeMap.get(e.idFim);
    const ctm = fromNode?.cotaTerreno ?? e.cotaTerrenoM;
    const ctj = toNode?.cotaTerreno ?? e.cotaTerrenoJ;
    const ccm = fromNode ? fromNode.cotaFundo : ctm - defaultDepth;
    const ccj = toNode ? toNode.cotaFundo : ctj - defaultDepth;
    const decl = e.comprimento > 0 ? (ccm - ccj) / e.comprimento : e.declividade;

    return {
      ...e,
      cotaTerrenoM: ctm,
      cotaTerrenoJ: ctj,
      cotaColetorM: ccm,
      cotaColetorJ: ccj,
      declividade: Math.round(decl * 1e6) / 1e6,
    };
  });
}

/**
 * Generate longitudinal profile data for a collector path.
 * Returns an array of data points for Recharts visualization.
 */
export interface ProfilePoint {
  distancia: number;
  cotaTerreno: number;
  cotaColetor: number;
  cotaCoroa: number;
  laminaDagua: number;
  nodeId: string;
  diametro: number;
  declividade: number;
  profundidade: number;
}

export function generateProfileData(
  nodes: SewerNetworkNode[],
  edges: SewerNetworkEdge[],
  results?: SewerSegmentResult[]
): ProfilePoint[] {
  if (edges.length === 0) return [];

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const resultMap = new Map<string, SewerSegmentResult>();
  if (results) {
    for (const r of results) resultMap.set(r.id, r);
  }

  // Build chain
  const adjacency = new Map<string, SewerNetworkEdge>();
  const inDeg = new Map<string, number>();

  for (const e of edges) {
    adjacency.set(e.idInicio, e);
    inDeg.set(e.idFim, (inDeg.get(e.idFim) || 0) + 1);
    if (!inDeg.has(e.idInicio)) inDeg.set(e.idInicio, 0);
  }

  // Find head node
  let head = edges[0].idInicio;
  for (const [nodeId, deg] of inDeg) {
    if (deg === 0 && adjacency.has(nodeId)) { head = nodeId; break; }
  }

  const points: ProfilePoint[] = [];
  let cumDist = 0;
  let current = head;

  // Starting node
  const startNode = nodeMap.get(current);
  if (startNode) {
    points.push({
      distancia: 0,
      cotaTerreno: startNode.cotaTerreno,
      cotaColetor: startNode.cotaFundo,
      cotaCoroa: startNode.cotaFundo,
      laminaDagua: startNode.cotaFundo,
      nodeId: current,
      diametro: 0,
      declividade: 0,
      profundidade: startNode.cotaTerreno - startNode.cotaFundo,
    });
  }

  const visited = new Set<string>();
  while (adjacency.has(current) && !visited.has(current)) {
    visited.add(current);
    const edge = adjacency.get(current)!;
    cumDist += edge.comprimento;

    const endNode = nodeMap.get(edge.idFim);
    const key = edge.key || `${edge.idInicio}-${edge.idFim}`;
    const result = resultMap.get(key) || resultMap.get(edge.dcId);
    const diamM = (result?.diametroMm || edge.diametro) / 1000;
    const yd = result?.laminaDagua || 0;
    const cf = endNode?.cotaFundo ?? edge.cotaColetorJ;
    const ct = endNode?.cotaTerreno ?? edge.cotaTerrenoJ;

    points.push({
      distancia: Math.round(cumDist * 10) / 10,
      cotaTerreno: ct,
      cotaColetor: cf,
      cotaCoroa: cf + diamM,
      laminaDagua: cf + yd * diamM,
      nodeId: edge.idFim,
      diametro: result?.diametroMm || edge.diametro,
      declividade: edge.declividade,
      profundidade: Math.round((ct - cf) * 100) / 100,
    });

    current = edge.idFim;
  }

  return points;
}

/**
 * Check for interference conflicts: verify that collector invert is deep enough
 * and doesn't conflict with other infrastructure at known elevations.
 */
export interface InterferencePoint {
  x: number;
  y: number;
  cotaInterferencia: number;
  descricao: string;
}

export function checkInterferences(
  edges: SewerNetworkEdge[],
  interferences: InterferencePoint[],
  nodes: SewerNetworkNode[],
  minClearance = 0.3
): { edgeKey: string; interferencia: string; conflito: boolean; folga: number }[] {
  if (interferences.length === 0) return [];

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const conflicts: { edgeKey: string; interferencia: string; conflito: boolean; folga: number }[] = [];

  for (const edge of edges) {
    const fromNode = nodeMap.get(edge.idInicio);
    const toNode = nodeMap.get(edge.idFim);
    if (!fromNode || !toNode) continue;

    for (const interf of interferences) {
      // Check if interference is near this segment (simple bounding box)
      const minX = Math.min(fromNode.x, toNode.x) - 5;
      const maxX = Math.max(fromNode.x, toNode.x) + 5;
      const minY = Math.min(fromNode.y, toNode.y) - 5;
      const maxY = Math.max(fromNode.y, toNode.y) + 5;

      if (interf.x < minX || interf.x > maxX || interf.y < minY || interf.y > maxY) continue;

      // Interpolate collector elevation at interference position
      const totalDist = edge.comprimento;
      if (totalDist <= 0) continue;

      const dx = interf.x - fromNode.x;
      const dy = interf.y - fromNode.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const frac = Math.min(dist / totalDist, 1);

      const cotaColetorAtPoint = edge.cotaColetorM + (edge.cotaColetorJ - edge.cotaColetorM) * frac;
      const folga = cotaColetorAtPoint - interf.cotaInterferencia;
      const conflito = Math.abs(folga) < minClearance;

      conflicts.push({
        edgeKey: edge.key || `${edge.idInicio}-${edge.idFim}`,
        interferencia: interf.descricao,
        conflito,
        folga: Math.round(folga * 100) / 100,
      });
    }
  }

  return conflicts;
}
