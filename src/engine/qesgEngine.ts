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

  // Detect cycles: if order doesn't contain all nodes, there's a cycle
  if (order.length < allNodeIds.size) {
    const cycleNodes = [...allNodeIds].filter(n => !order.includes(n));
    throw new Error(
      `Ciclo detectado na rede: ${cycleNodes.length} nó(s) em ciclo. ` +
      `IDs: ${cycleNodes.slice(0, 5).join(', ')}${cycleNodes.length > 5 ? '...' : ''}. ` +
      `Verifique a topologia e corrija as conexões.`
    );
  }

  // Name nodes as PV-001, PV-002... in topological order
  const nodeNameMap = new Map<string, string>();
  order.forEach((id, i) => {
    nodeNameMap.set(id, `PV-${String(i + 1).padStart(3, "0")}`);
  });

  // Number edges with remapped node IDs
  let edgeIdx = 0;
  const numberedEdges = edges.map(e => ({
    ...e,
    dcId: `C${String(++edgeIdx).padStart(3, "0")}`,
    idInicio: nodeNameMap.get(e.idInicio) || e.idInicio,
    idFim: nodeNameMap.get(e.idFim) || e.idFim,
  }));

  // Rename nodes
  const renamedNodes = nodes.map(n => ({
    ...n,
    id: nodeNameMap.get(n.id) || n.id,
  }));

  return { nodes: renamedNodes, edges: numberedEdges };
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

// ══════════════════════════════════════
// Button 08: Minimum Cover Points
// ══════════════════════════════════════

export interface MinCoverAlertPoint {
  id: string;
  edgeKey: string;
  x: number;
  y: number;
  cotaTerreno: number;
  cotaColetor: number;
  recobrimento: number;
  recobrimentoMinimo: number;
  deficit: number;
}

/**
 * Find points along the network where cover (CTN - CColetor - DN) is less
 * than the configured minimum.  Returns alert points at each offending endpoint.
 */
export function findMinCoverPoints(
  nodes: SewerNetworkNode[],
  edges: SewerNetworkEdge[],
  results: SewerSegmentResult[],
  recobrimentoMinimo: number
): MinCoverAlertPoint[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const resultMap = new Map(results.map(r => [r.id, r]));
  const alerts: MinCoverAlertPoint[] = [];
  let idx = 0;

  for (const edge of edges) {
    const key = edge.key || `${edge.idInicio}-${edge.idFim}`;
    const result = resultMap.get(key) || resultMap.get(edge.dcId);
    const diamM = (result?.diametroMm || edge.diametro || 150) / 1000;

    // Check upstream end
    const fromNode = nodeMap.get(edge.idInicio);
    if (fromNode) {
      const recM = fromNode.cotaTerreno - edge.cotaColetorM - diamM;
      if (recM < recobrimentoMinimo) {
        alerts.push({
          id: `REC-${++idx}`,
          edgeKey: key,
          x: fromNode.x,
          y: fromNode.y,
          cotaTerreno: fromNode.cotaTerreno,
          cotaColetor: edge.cotaColetorM,
          recobrimento: Math.round(recM * 100) / 100,
          recobrimentoMinimo,
          deficit: Math.round((recobrimentoMinimo - recM) * 100) / 100,
        });
      }
    }

    // Check downstream end
    const toNode = nodeMap.get(edge.idFim);
    if (toNode) {
      const recJ = toNode.cotaTerreno - edge.cotaColetorJ - diamM;
      if (recJ < recobrimentoMinimo) {
        alerts.push({
          id: `REC-${++idx}`,
          edgeKey: key,
          x: toNode.x,
          y: toNode.y,
          cotaTerreno: toNode.cotaTerreno,
          cotaColetor: edge.cotaColetorJ,
          recobrimento: Math.round(recJ * 100) / 100,
          recobrimentoMinimo,
          deficit: Math.round((recobrimentoMinimo - recJ) * 100) / 100,
        });
      }
    }
  }

  return alerts;
}

// ══════════════════════════════════════
// Diameter Summary
// ══════════════════════════════════════

export interface DiameterSummaryRow {
  diametro: number;
  quantidade: number;
  extensaoTotal: number;
  extensaoMedia: number;
}

export function summarizeByDiameter(
  edges: SewerNetworkEdge[],
  results: SewerSegmentResult[]
): DiameterSummaryRow[] {
  const resultMap = new Map(results.map(r => [r.id, r]));
  const groups = new Map<number, { count: number; length: number }>();

  for (const edge of edges) {
    const key = edge.key || `${edge.idInicio}-${edge.idFim}`;
    const result = resultMap.get(key) || resultMap.get(edge.dcId);
    const dn = result?.diametroMm || edge.diametro || 150;
    const existing = groups.get(dn) || { count: 0, length: 0 };
    existing.count++;
    existing.length += edge.comprimento;
    groups.set(dn, existing);
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([dn, g]) => ({
      diametro: dn,
      quantidade: g.count,
      extensaoTotal: Math.round(g.length * 100) / 100,
      extensaoMedia: Math.round((g.length / g.count) * 100) / 100,
    }));
}

// ══════════════════════════════════════
// DXF Import (minimal parser for CAD/Sancad)
// ══════════════════════════════════════

export interface DxfImportedLine {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
  layer: string;
}

export interface DxfImportedPoint {
  x: number; y: number; z: number;
  layer: string;
  label?: string;
}

export function parseDxfText(dxfContent: string): {
  lines: DxfImportedLine[];
  points: DxfImportedPoint[];
} {
  const lines: DxfImportedLine[] = [];
  const points: DxfImportedPoint[] = [];

  // Split into lines and process entity by entity
  const rawLines = dxfContent.split("\n").map(l => l.trim());

  let i = 0;
  let inEntities = false;

  while (i < rawLines.length) {
    const code = rawLines[i];
    const value = rawLines[i + 1] || "";

    if (code === "2" && value === "ENTITIES") {
      inEntities = true;
      i += 2;
      continue;
    }
    if (code === "0" && value === "ENDSEC" && inEntities) {
      break;
    }

    if (inEntities && code === "0" && value === "LINE") {
      let layer = "0", x1 = 0, y1 = 0, z1 = 0, x2 = 0, y2 = 0, z2 = 0;
      i += 2;
      while (i < rawLines.length && !(rawLines[i] === "0" && rawLines[i + 1] !== undefined && !rawLines[i + 1].match(/^\d/))) {
        const c = rawLines[i], v = rawLines[i + 1] || "";
        if (c === "8") layer = v;
        else if (c === "10") x1 = parseFloat(v);
        else if (c === "20") y1 = parseFloat(v);
        else if (c === "30") z1 = parseFloat(v);
        else if (c === "11") x2 = parseFloat(v);
        else if (c === "21") y2 = parseFloat(v);
        else if (c === "31") z2 = parseFloat(v);
        i += 2;
        if (rawLines[i] === "0") break;
      }
      lines.push({ x1, y1, z1, x2, y2, z2, layer });
      continue;
    }

    if (inEntities && code === "0" && (value === "POINT" || value === "INSERT")) {
      let layer = "0", x = 0, y = 0, z = 0;
      i += 2;
      while (i < rawLines.length) {
        const c = rawLines[i], v = rawLines[i + 1] || "";
        if (c === "8") layer = v;
        else if (c === "10") x = parseFloat(v);
        else if (c === "20") y = parseFloat(v);
        else if (c === "30") z = parseFloat(v);
        i += 2;
        if (rawLines[i] === "0") break;
      }
      points.push({ x, y, z, layer });
      continue;
    }

    if (inEntities && code === "0" && value === "LWPOLYLINE") {
      let layer = "0";
      const verts: { x: number; y: number; z: number }[] = [];
      let elevation = 0;
      i += 2;
      while (i < rawLines.length) {
        const c = rawLines[i], v = rawLines[i + 1] || "";
        if (c === "8") layer = v;
        else if (c === "38") elevation = parseFloat(v);
        else if (c === "10") {
          const vtx = { x: parseFloat(v), y: 0, z: elevation };
          // Read Y (code 20) next
          if (rawLines[i + 2] === "20") {
            vtx.y = parseFloat(rawLines[i + 3]);
            i += 2;
          }
          verts.push(vtx);
        }
        i += 2;
        if (rawLines[i] === "0") break;
      }
      // Convert polyline to individual line segments
      for (let j = 0; j < verts.length - 1; j++) {
        lines.push({
          x1: verts[j].x, y1: verts[j].y, z1: verts[j].z,
          x2: verts[j + 1].x, y2: verts[j + 1].y, z2: verts[j + 1].z,
          layer,
        });
      }
      continue;
    }

    i += 2;
  }

  return { lines, points };
}

// ══════════════════════════════════════
// DXF Export (enhanced for sewer networks)
// ══════════════════════════════════════

export function exportSewerDxf(
  nodes: SewerNetworkNode[],
  edges: SewerNetworkEdge[],
  results: SewerSegmentResult[]
): string {
  const resultMap = new Map(results.map(r => [r.id, r]));

  // Collect unique diameters for layer names
  const diameters = new Set<number>();
  for (const r of results) diameters.add(r.diametroMm);

  let dxf = `0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${diameters.size + 2}\n`;

  // PV layer
  dxf += `0\nLAYER\n2\nPVs\n70\n0\n62\n3\n6\nCONTINUOUS\n`;

  // One layer per diameter
  let colorIdx = 1;
  for (const dn of Array.from(diameters).sort((a, b) => a - b)) {
    dxf += `0\nLAYER\n2\nDN${dn}\n70\n0\n62\n${colorIdx++ % 7 + 1}\n6\nCONTINUOUS\n`;
  }

  dxf += `0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n`;

  // Draw PVs as circles + text
  for (const n of nodes) {
    dxf += `0\nCIRCLE\n8\nPVs\n10\n${n.x.toFixed(4)}\n20\n${n.y.toFixed(4)}\n30\n${n.cotaTerreno.toFixed(4)}\n40\n0.5\n`;
    dxf += `0\nTEXT\n8\nPVs\n10\n${(n.x + 1).toFixed(4)}\n20\n${(n.y + 1).toFixed(4)}\n30\n${n.cotaTerreno.toFixed(4)}\n40\n1.2\n1\n${n.id}\n`;
  }

  // Draw edges by diameter layer
  for (const edge of edges) {
    const key = edge.key || `${edge.idInicio}-${edge.idFim}`;
    const result = resultMap.get(key) || resultMap.get(edge.dcId);
    const dn = result?.diametroMm || edge.diametro || 150;
    const layerName = `DN${dn}`;

    const fromNode = nodes.find(n => n.id === edge.idInicio);
    const toNode = nodes.find(n => n.id === edge.idFim);
    if (!fromNode || !toNode) continue;

    dxf += `0\nLINE\n8\n${layerName}\n10\n${fromNode.x.toFixed(4)}\n20\n${fromNode.y.toFixed(4)}\n30\n${edge.cotaColetorM.toFixed(4)}\n11\n${toNode.x.toFixed(4)}\n21\n${toNode.y.toFixed(4)}\n31\n${edge.cotaColetorJ.toFixed(4)}\n`;

    // Label at midpoint
    const mx = (fromNode.x + toNode.x) / 2;
    const my = (fromNode.y + toNode.y) / 2;
    const mz = (edge.cotaColetorM + edge.cotaColetorJ) / 2;
    dxf += `0\nTEXT\n8\n${layerName}\n10\n${mx.toFixed(4)}\n20\n${(my + 1).toFixed(4)}\n30\n${mz.toFixed(4)}\n40\n1.0\n1\n${edge.dcId} DN${dn}\n`;
  }

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
}

// ══════════════════════════════════════
// LandXML Import/Export (Civil 3D)
// ══════════════════════════════════════

export interface LandXMLPipe {
  name: string;
  startStructure: string;
  endStructure: string;
  diameter: number;
  length: number;
  invertStart: number;
  invertEnd: number;
  material: string;
}

export interface LandXMLStructure {
  name: string;
  x: number;
  y: number;
  rimElevation: number;
  invertElevation: number;
}

export function parseLandXML(xmlText: string): {
  pipes: LandXMLPipe[];
  structures: LandXMLStructure[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const pipes: LandXMLPipe[] = [];
  const structures: LandXMLStructure[] = [];

  // Parse structures
  const structNodes = doc.querySelectorAll("Struct, Structure");
  structNodes.forEach(sNode => {
    const name = sNode.getAttribute("name") || sNode.getAttribute("Name") || "";
    const center = sNode.querySelector("Center");
    let x = 0, y = 0;
    if (center) {
      const coords = (center.textContent || "").trim().split(/\s+/);
      y = parseFloat(coords[0]) || 0;  // LandXML: northing first
      x = parseFloat(coords[1]) || 0;
    }
    const rim = parseFloat(sNode.getAttribute("elevRim") || sNode.getAttribute("ElevRim") || "0");
    const invert = parseFloat(sNode.getAttribute("elevSump") || sNode.getAttribute("ElevSump") || "0");
    structures.push({ name, x, y, rimElevation: rim, invertElevation: invert });
  });

  // Parse pipes
  const pipeNodes = doc.querySelectorAll("Pipe");
  pipeNodes.forEach(pNode => {
    const name = pNode.getAttribute("name") || pNode.getAttribute("Name") || "";
    const refStart = pNode.getAttribute("refStart") || pNode.getAttribute("RefStart") || "";
    const refEnd = pNode.getAttribute("refEnd") || pNode.getAttribute("RefEnd") || "";
    const diam = parseFloat(pNode.getAttribute("diameter") || pNode.getAttribute("Diameter") || "0.15") * 1000;
    const length = parseFloat(pNode.getAttribute("length") || pNode.getAttribute("Length") || "0");

    const startEl = pNode.querySelector("Start, PipeStart");
    const endEl = pNode.querySelector("End, PipeEnd");
    const invertStart = parseFloat(startEl?.getAttribute("elev") || startEl?.textContent || "0");
    const invertEnd = parseFloat(endEl?.getAttribute("elev") || endEl?.textContent || "0");
    const mat = pNode.getAttribute("material") || "PVC";

    pipes.push({ name, startStructure: refStart, endStructure: refEnd, diameter: diam, length, invertStart, invertEnd, material: mat });
  });

  return { pipes, structures };
}

export function exportLandXML(
  nodes: SewerNetworkNode[],
  edges: SewerNetworkEdge[],
  results: SewerSegmentResult[],
  projectName = "QEsg_Web"
): string {
  const resultMap = new Map(results.map(r => [r.id, r]));

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2">\n`;
  xml += `  <Project name="${projectName}" />\n`;
  xml += `  <PipeNetworks name="Sewer">\n`;
  xml += `    <PipeNetwork name="Rede_Esgoto" pipeNetType="storm">\n`;
  xml += `      <Structs>\n`;

  for (const n of nodes) {
    xml += `        <Struct name="${n.id}" elevRim="${n.cotaTerreno.toFixed(3)}" elevSump="${n.cotaFundo.toFixed(3)}">\n`;
    xml += `          <Center>${n.y.toFixed(4)} ${n.x.toFixed(4)}</Center>\n`;
    xml += `        </Struct>\n`;
  }

  xml += `      </Structs>\n`;
  xml += `      <Pipes>\n`;

  for (const edge of edges) {
    const key = edge.key || `${edge.idInicio}-${edge.idFim}`;
    const result = resultMap.get(key) || resultMap.get(edge.dcId);
    const dn = result?.diametroMm || edge.diametro || 150;
    const diamM = dn / 1000;

    xml += `        <Pipe name="${edge.dcId}" refStart="${edge.idInicio}" refEnd="${edge.idFim}" diameter="${diamM.toFixed(3)}" length="${edge.comprimento.toFixed(3)}" material="${edge.key ? 'PVC' : 'PVC'}">\n`;
    xml += `          <CircPipe diameter="${diamM.toFixed(3)}" />\n`;
    xml += `        </Pipe>\n`;
  }

  xml += `      </Pipes>\n`;
  xml += `    </PipeNetwork>\n`;
  xml += `  </PipeNetworks>\n`;
  xml += `</LandXML>\n`;

  return xml;
}

// ══════════════════════════════════════
// Report Generation
// ══════════════════════════════════════

export function generateProjectReport(
  config: {
    populacaoInicial: number;
    populacaoSaturacao: number;
    perCapita: number;
    k1: number;
    k2: number;
    coefRetorno: number;
    taxaInfiltracao: number;
    manning: number;
    material: string;
    norma: string;
    diametroMinimo: number;
    recobrimentoMinimo: number;
    laminaMaxima: number;
    tensaoMinima: number;
    velMinima: number;
    velMaxima: number;
  },
  nodeCount: number,
  edgeCount: number
): string {
  return `
╔══════════════════════════════════════════════════════╗
║              DADOS DO PROJETO — QEsg Web             ║
╠══════════════════════════════════════════════════════╣
║ Norma Técnica:       ${config.norma.padEnd(30)} ║
║ Material Padrão:     ${config.material.padEnd(30)} ║
║ Manning (n):         ${config.manning.toFixed(4).padEnd(30)} ║
╠══════════════════════════════════════════════════════╣
║ DADOS POPULACIONAIS                                  ║
║ Pop. Inicial:        ${String(config.populacaoInicial).padEnd(30)} ║
║ Pop. Saturação:      ${String(config.populacaoSaturacao).padEnd(30)} ║
║ Per Capita:          ${(config.perCapita + " L/hab.dia").padEnd(30)} ║
║ K1:                  ${config.k1.toFixed(2).padEnd(30)} ║
║ K2:                  ${config.k2.toFixed(2).padEnd(30)} ║
║ Coef. Retorno:       ${config.coefRetorno.toFixed(2).padEnd(30)} ║
║ Tx. Infiltração:     ${(config.taxaInfiltracao + " L/s.m").padEnd(30)} ║
╠══════════════════════════════════════════════════════╣
║ CRITÉRIOS HIDRÁULICOS                                ║
║ Diâmetro Mínimo:     ${(config.diametroMinimo + " mm").padEnd(30)} ║
║ Recobr. Mínimo:      ${(config.recobrimentoMinimo + " m").padEnd(30)} ║
║ Lâmina Máxima:       ${(config.laminaMaxima + " (y/D)").padEnd(30)} ║
║ Tensão Mín:          ${(config.tensaoMinima + " Pa").padEnd(30)} ║
║ Vel. Mín:            ${(config.velMinima + " m/s").padEnd(30)} ║
║ Vel. Máx:            ${(config.velMaxima + " m/s").padEnd(30)} ║
╠══════════════════════════════════════════════════════╣
║ REDE                                                 ║
║ Nós (PVs):           ${String(nodeCount).padEnd(30)} ║
║ Trechos:             ${String(edgeCount).padEnd(30)} ║
╚══════════════════════════════════════════════════════╝
`.trim();
}

export function generateResultsCSV(
  edges: SewerNetworkEdge[],
  nodes: SewerNetworkNode[],
  results: SewerSegmentResult[]
): string {
  const resultMap = new Map(results.map(r => [r.id, r]));
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  let csv = "DC_ID;PVM;PVJ;LENGTH;CTM;CTJ;CCM;CCJ;PRFM;PRFJ;DIAMETER;DN_CALC;DECL;VEL;VEL_CRIT;Y/D;TRATIVA;STATUS;OBS\n";

  for (const edge of edges) {
    const key = edge.key || `${edge.idInicio}-${edge.idFim}`;
    const r = resultMap.get(key) || resultMap.get(edge.dcId);
    const fromNode = nodeMap.get(edge.idInicio);
    const toNode = nodeMap.get(edge.idFim);
    const prfM = fromNode ? (fromNode.cotaTerreno - edge.cotaColetorM) : 0;
    const prfJ = toNode ? (toNode.cotaTerreno - edge.cotaColetorJ) : 0;

    csv += [
      edge.dcId,
      edge.idInicio,
      edge.idFim,
      edge.comprimento.toFixed(2),
      edge.cotaTerrenoM.toFixed(2),
      edge.cotaTerrenoJ.toFixed(2),
      edge.cotaColetorM.toFixed(2),
      edge.cotaColetorJ.toFixed(2),
      prfM.toFixed(2),
      prfJ.toFixed(2),
      r?.diametroMm || edge.diametro,
      r?.diametroCalculadoMm || "",
      (r?.declividadeUsada || edge.declividade || 0).toFixed(6),
      r?.velocidadeMs.toFixed(3) || "",
      r?.velocidadeCriticaMs.toFixed(3) || "",
      r?.laminaDagua.toFixed(4) || "",
      r?.tensaoTrativa.toFixed(3) || "",
      r?.atendeNorma ? "OK" : "FALHA",
      r?.observacoes?.join(" | ") || "",
    ].join(";") + "\n";
  }

  return csv;
}
