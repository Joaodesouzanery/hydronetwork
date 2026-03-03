/**
 * CAESB/SABESP Compliance Engine
 *
 * Isolated module for checking compliance with CAESB (Companhia de
 * Saneamento Ambiental do Distrito Federal) and SABESP technical
 * standards for water supply and sewage networks.
 *
 * Standards covered:
 * - CAESB NTS 181 (Redes de distribuição de água)
 * - CAESB NTS 182 (Adutoras)
 * - CAESB NTS 183 (Redes coletoras de esgoto)
 * - SABESP NTS 019 (Projeto de redes de distribuição de água)
 * - SABESP NTS 025 (Projeto de redes coletoras de esgoto)
 * - NBR 9649, NBR 12211, NBR 12214, NBR 12215, NBR 12218
 * - Acórdão TCU 2622/2013 (BDI)
 *
 * This engine is purely computational — no UI or database dependencies.
 */

// ══════════════════════════════════════
// Types
// ══════════════════════════════════════

export type Severity = "info" | "warning" | "critical" | "ok";
export type NetworkType = "agua" | "esgoto" | "drenagem" | "adutora" | "elevatoria";

export interface CAESBCheckResult {
  id: string;
  category: string;
  description: string;
  normReference: string;
  severity: Severity;
  value?: string;
  limit?: string;
  recommendation?: string;
}

export interface CAESBComplianceReport {
  networkType: NetworkType;
  totalChecks: number;
  passed: number;
  warnings: number;
  critical: number;
  checks: CAESBCheckResult[];
  overallStatus: "aprovado" | "com_ressalvas" | "reprovado";
  generatedAt: string;
}

// ── Water Network Input ──

export interface WaterNetworkInput {
  diameters: number[];         // DN (mm) per section
  velocities: number[];        // m/s per section
  pressuresMin: number[];      // mca
  pressuresMax: number[];      // mca
  coverDepth: number[];        // m (profundidade recobrimento)
  pipeLength: number;          // total m
  pipeMaterial: string;        // PVC, PEAD, FoFo, etc.
  hasCheckValve: boolean;
  hasPressureReducer: boolean;
  flowRate: number;            // L/s
  demandDay: number;           // L/hab.dia
  population: number;
}

// ── Sewer Network Input ──

export interface SewerNetworkInput {
  diameters: number[];         // DN (mm)
  velocities: number[];        // m/s
  slopes: number[];            // m/m (declividade)
  depthsUpstream: number[];    // m (profundidade poço montante)
  depthsDownstream: number[];  // m (profundidade poço jusante)
  tractiveStress: number[];    // Pa (tensão trativa)
  waterLevel: number[];        // Y/D (lâmina relativa)
  pipeMaterial: string;
  hasManholeVent: boolean;
  manholeSpacing: number[];    // m (espaçamento entre PVs)
}

// ── Transient / Adutora Input ──

export interface TransientInput {
  diameter: number;            // mm
  length: number;              // m
  waveSpeed: number;           // m/s
  velocity: number;            // m/s
  steadyPressure: number;      // mca
  closureTime: number;         // s
  maxPressure: number;         // mca
  minPressure: number;         // mca
  hasMOCSimulation: boolean;
  hasProtectionDevices: boolean;
  pipeMaterial: string;
  pressureClass: number;       // PN (classe de pressão)
}

// ── Elevator Station Input ──

export interface ElevatorStationInput {
  flowRate: number;            // L/s
  tdh: number;                 // m (altura manométrica total)
  power: number;               // CV
  efficiency: number;          // % (rendimento da bomba)
  npshAvailable: number;       // m
  npshRequired: number;        // m
  numPumps: number;
  numReserve: number;
  suctionVelocity: number;     // m/s
  dischargeVelocity: number;   // m/s
  networkType: "agua" | "esgoto";
}

// ══════════════════════════════════════
// CAESB Constants
// ══════════════════════════════════════

const CAESB_WATER = {
  velocityMin: 0.6,            // m/s — NTS 181 / NBR 12218
  velocityMax: 3.5,            // m/s
  pressureMin: 10,             // mca — pressão estática mínima
  pressureMax: 50,             // mca — pressão estática máxima
  pressureDynMin: 8,           // mca — pressão dinâmica mínima
  diameterMin: 50,             // mm
  coverDepthMin: 0.60,         // m — recobrimento mínimo
  coverDepthMinSidewalk: 0.50, // m — sob calçada
  coverDepthMinRoad: 0.80,     // m — sob leito carroçável
  maxSectionLength: 600,       // m entre registros
  demandPerCapita: { min: 150, max: 300 }, // L/hab.dia
} as const;

const CAESB_SEWER = {
  velocityMin: 0.6,            // m/s — NTS 183 / NBR 9649
  velocityMax: 5.0,            // m/s (máxima final)
  velocityCritical: 4.5,       // m/s (CAESB limite prático)
  slopeMinDN150: 0.005,        // m/m para DN 150
  slopeMinDN200: 0.004,        // m/m para DN 200
  diameterMin: 150,            // mm — CAESB: DN mínimo 150mm
  tractiveStressMin: 1.0,      // Pa — tensão trativa mínima
  tractiveStressSabesp: 1.5,   // Pa — SABESP mais conservador
  waterLevelMax: 0.75,         // Y/D — lâmina máxima 75%
  waterLevelMaxFinal: 0.50,    // Y/D — contribuinte final
  manholeSpacingMax: 80,       // m — espaçamento máximo PVs DN < 400
  manholeSpacingMaxLarge: 100, // m — DN ≥ 400
  depthMin: 0.90,              // m — profundidade mínima
  depthMinWithTraffic: 1.20,   // m — sob leito carroçável
} as const;

const CAESB_TRANSIENT = {
  diameterMOCRequired: 300,     // mm — CAESB obriga MOC ≥ DN 300
  maxSurgePercent: 0.50,        // 50% da pressão estática
  maxSurgeAbsolute: 40,         // mca — sobrepressão máxima aceitável
  minPressureAllowed: -8,       // mca — subpressão antes de cavitação
} as const;

const CAESB_ELEVATOR = {
  suctionVelocityMaxWater: 1.5,  // m/s
  suctionVelocityMaxSewer: 1.5,
  dischargeVelocityMinWater: 0.5,
  dischargeVelocityMaxWater: 2.5,
  dischargeVelocityMinSewer: 0.6,
  dischargeVelocityMaxSewer: 3.0,
  npshMargin: 0.5,               // m — margem mínima NPSH
  minReservePumps: 1,            // bomba reserva mínima
  minReservePumpsSewer: 1,
} as const;

// ══════════════════════════════════════
// Checkers
// ══════════════════════════════════════

let checkIdCounter = 0;
function nextId(): string {
  checkIdCounter++;
  return `CAESB-${String(checkIdCounter).padStart(3, "0")}`;
}

function check(
  category: string,
  description: string,
  normReference: string,
  severity: Severity,
  value?: string,
  limit?: string,
  recommendation?: string,
): CAESBCheckResult {
  return { id: nextId(), category, description, normReference, severity, value, limit, recommendation };
}

// ══════════════════════════════════════
// Water Network Checks
// ══════════════════════════════════════

export function checkWaterNetwork(input: WaterNetworkInput): CAESBCheckResult[] {
  checkIdCounter = 0;
  const results: CAESBCheckResult[] = [];

  // 1. Diameter check
  const minDiam = Math.min(...input.diameters);
  if (minDiam < CAESB_WATER.diameterMin) {
    results.push(check(
      "Diâmetro", `DN mínimo encontrado: ${minDiam}mm`, "CAESB NTS 181 / NBR 12218",
      "critical", `${minDiam}mm`, `≥ ${CAESB_WATER.diameterMin}mm`,
      `Aumentar diâmetro mínimo para DN ${CAESB_WATER.diameterMin}mm`
    ));
  } else {
    results.push(check(
      "Diâmetro", `DN mínimo ${minDiam}mm atende requisito`, "CAESB NTS 181",
      "ok", `${minDiam}mm`, `≥ ${CAESB_WATER.diameterMin}mm`
    ));
  }

  // 2. Velocity checks
  input.velocities.forEach((v, i) => {
    if (v < CAESB_WATER.velocityMin) {
      results.push(check(
        "Velocidade", `Trecho ${i + 1}: velocidade ${v.toFixed(2)} m/s abaixo do mínimo`,
        "CAESB NTS 181 §5.3", "warning",
        `${v.toFixed(2)} m/s`, `${CAESB_WATER.velocityMin} - ${CAESB_WATER.velocityMax} m/s`,
        "Reduzir diâmetro ou aumentar vazão para atingir velocidade mínima"
      ));
    } else if (v > CAESB_WATER.velocityMax) {
      results.push(check(
        "Velocidade", `Trecho ${i + 1}: velocidade ${v.toFixed(2)} m/s acima do máximo`,
        "CAESB NTS 181 §5.3", "critical",
        `${v.toFixed(2)} m/s`, `≤ ${CAESB_WATER.velocityMax} m/s`,
        "Aumentar diâmetro para reduzir velocidade"
      ));
    }
  });

  // 3. Pressure checks
  input.pressuresMin.forEach((p, i) => {
    if (p < CAESB_WATER.pressureDynMin) {
      results.push(check(
        "Pressão Mínima", `Nó ${i + 1}: pressão dinâmica ${p.toFixed(1)} mca < mínimo`,
        "CAESB NTS 181 §4.2 / NBR 12218", "critical",
        `${p.toFixed(1)} mca`, `≥ ${CAESB_WATER.pressureDynMin} mca`,
        "Verificar cotas piezométricas. Considerar booster ou reservatório elevado."
      ));
    }
  });

  input.pressuresMax.forEach((p, i) => {
    if (p > CAESB_WATER.pressureMax) {
      results.push(check(
        "Pressão Máxima", `Nó ${i + 1}: pressão estática ${p.toFixed(1)} mca > máximo`,
        "CAESB NTS 181 §4.2", "critical",
        `${p.toFixed(1)} mca`, `≤ ${CAESB_WATER.pressureMax} mca`,
        "Instalar válvula redutora de pressão (VRP) ou setorizar a rede"
      ));
    }
  });

  // 4. Cover depth
  input.coverDepth.forEach((d, i) => {
    if (d < CAESB_WATER.coverDepthMin) {
      results.push(check(
        "Recobrimento", `Trecho ${i + 1}: recobrimento ${d.toFixed(2)}m < mínimo`,
        "CAESB NTS 181 §6.1", "warning",
        `${d.toFixed(2)}m`, `≥ ${CAESB_WATER.coverDepthMin}m`,
        "Aprofundar tubulação ou usar proteção mecânica"
      ));
    }
  });

  // 5. Per capita demand
  if (input.demandDay < CAESB_WATER.demandPerCapita.min || input.demandDay > CAESB_WATER.demandPerCapita.max) {
    results.push(check(
      "Demanda Per Capita", `${input.demandDay} L/hab.dia fora da faixa CAESB`,
      "CAESB NTS 181 §3.1", "warning",
      `${input.demandDay} L/hab.dia`,
      `${CAESB_WATER.demandPerCapita.min}-${CAESB_WATER.demandPerCapita.max} L/hab.dia`,
      "Justificar demanda no memorial descritivo"
    ));
  } else {
    results.push(check(
      "Demanda Per Capita", `${input.demandDay} L/hab.dia dentro da faixa`,
      "CAESB NTS 181 §3.1", "ok",
      `${input.demandDay} L/hab.dia`,
      `${CAESB_WATER.demandPerCapita.min}-${CAESB_WATER.demandPerCapita.max} L/hab.dia`
    ));
  }

  // 6. Check valve presence
  if (!input.hasCheckValve && input.flowRate > 10) {
    results.push(check(
      "Válvula de Retenção", "Rede com vazão > 10 L/s sem válvula de retenção",
      "CAESB NTS 182 §7.4", "warning",
      "Ausente", "Obrigatória para Q > 10 L/s",
      "Instalar válvula de retenção na saída do booster/reservatório"
    ));
  }

  // Summary
  const vOk = input.velocities.filter(v => v >= CAESB_WATER.velocityMin && v <= CAESB_WATER.velocityMax).length;
  if (vOk === input.velocities.length) {
    results.push(check(
      "Velocidade Geral", `Todos os ${vOk} trechos com velocidade adequada`,
      "CAESB NTS 181", "ok"
    ));
  }

  return results;
}

// ══════════════════════════════════════
// Sewer Network Checks
// ══════════════════════════════════════

export function checkSewerNetwork(input: SewerNetworkInput): CAESBCheckResult[] {
  checkIdCounter = 0;
  const results: CAESBCheckResult[] = [];

  // 1. Diameter minimum
  const minDiam = Math.min(...input.diameters);
  if (minDiam < CAESB_SEWER.diameterMin) {
    results.push(check(
      "Diâmetro Mínimo", `DN mínimo ${minDiam}mm. CAESB exige DN ≥ ${CAESB_SEWER.diameterMin}mm`,
      "CAESB NTS 183 §4.1 / NBR 9649", "critical",
      `${minDiam}mm`, `≥ ${CAESB_SEWER.diameterMin}mm`,
      `Usar DN ${CAESB_SEWER.diameterMin}mm como diâmetro mínimo`
    ));
  } else {
    results.push(check(
      "Diâmetro Mínimo", `DN mínimo ${minDiam}mm atende CAESB`,
      "CAESB NTS 183 §4.1", "ok", `${minDiam}mm`, `≥ ${CAESB_SEWER.diameterMin}mm`
    ));
  }

  // 2. Velocity
  input.velocities.forEach((v, i) => {
    if (v < CAESB_SEWER.velocityMin) {
      results.push(check(
        "Velocidade", `Trecho ${i + 1}: ${v.toFixed(2)} m/s < mínimo de auto-limpeza`,
        "CAESB NTS 183 §5.2", "warning",
        `${v.toFixed(2)} m/s`, `≥ ${CAESB_SEWER.velocityMin} m/s`,
        "Aumentar declividade ou reduzir diâmetro"
      ));
    }
    if (v > CAESB_SEWER.velocityCritical) {
      results.push(check(
        "Velocidade", `Trecho ${i + 1}: ${v.toFixed(2)} m/s > limite prático CAESB`,
        "CAESB NTS 183 §5.2", "critical",
        `${v.toFixed(2)} m/s`, `≤ ${CAESB_SEWER.velocityCritical} m/s`,
        "Reduzir declividade, usar degraus ou tubo de queda"
      ));
    }
  });

  // 3. Tractive stress
  input.tractiveStress.forEach((t, i) => {
    if (t < CAESB_SEWER.tractiveStressMin) {
      results.push(check(
        "Tensão Trativa", `Trecho ${i + 1}: ${t.toFixed(2)} Pa < mínimo CAESB`,
        "CAESB NTS 183 §5.3 / NBR 9649", "critical",
        `${t.toFixed(2)} Pa`, `≥ ${CAESB_SEWER.tractiveStressMin} Pa`,
        "Aumentar declividade para garantir autolimpeza"
      ));
    }
  });

  // 4. Water level (Y/D)
  input.waterLevel.forEach((yd, i) => {
    if (yd > CAESB_SEWER.waterLevelMax) {
      results.push(check(
        "Lâmina d'Água", `Trecho ${i + 1}: Y/D = ${(yd * 100).toFixed(0)}% > 75%`,
        "CAESB NTS 183 §5.1 / NBR 9649", "critical",
        `${(yd * 100).toFixed(0)}%`, `≤ 75%`,
        "Aumentar diâmetro do trecho"
      ));
    }
  });

  // 5. Depth checks
  input.depthsUpstream.forEach((d, i) => {
    if (d < CAESB_SEWER.depthMin) {
      results.push(check(
        "Profundidade PV", `PV montante ${i + 1}: ${d.toFixed(2)}m < mínimo CAESB`,
        "CAESB NTS 183 §6.2", "warning",
        `${d.toFixed(2)}m`, `≥ ${CAESB_SEWER.depthMin}m`,
        "Aprofundar PV para atender recobrimento mínimo"
      ));
    }
  });

  // 6. Manhole spacing
  input.manholeSpacing.forEach((s, i) => {
    const maxS = (input.diameters[i] || 200) >= 400
      ? CAESB_SEWER.manholeSpacingMaxLarge
      : CAESB_SEWER.manholeSpacingMax;
    if (s > maxS) {
      results.push(check(
        "Espaçamento PV", `Trecho ${i + 1}: ${s.toFixed(0)}m > máximo ${maxS}m`,
        "CAESB NTS 183 §6.4", "warning",
        `${s.toFixed(0)}m`, `≤ ${maxS}m`,
        "Adicionar PV intermediário"
      ));
    }
  });

  // 7. Slope minimums
  input.slopes.forEach((sl, i) => {
    const dn = input.diameters[i] || 200;
    const minSlope = dn <= 150 ? CAESB_SEWER.slopeMinDN150 : CAESB_SEWER.slopeMinDN200;
    if (sl < minSlope) {
      results.push(check(
        "Declividade", `Trecho ${i + 1} (DN${dn}): declividade ${(sl * 1000).toFixed(1)}‰ < mínimo`,
        "CAESB NTS 183 §5.4", "critical",
        `${(sl * 1000).toFixed(1)}‰`, `≥ ${(minSlope * 1000).toFixed(1)}‰`,
        "Ajustar cotas dos PVs para aumentar declividade"
      ));
    }
  });

  return results;
}

// ══════════════════════════════════════
// Transient / Adutora Checks
// ══════════════════════════════════════

export function checkTransient(input: TransientInput): CAESBCheckResult[] {
  checkIdCounter = 0;
  const results: CAESBCheckResult[] = [];

  // 1. MOC simulation requirement
  if (input.diameter >= CAESB_TRANSIENT.diameterMOCRequired) {
    if (!input.hasMOCSimulation) {
      results.push(check(
        "Simulação MOC", `DN ${input.diameter}mm ≥ ${CAESB_TRANSIENT.diameterMOCRequired}mm — MOC obrigatório`,
        "CAESB NTS 182 §8.1 / NBR 12215", "critical",
        "Não realizada", "Obrigatória",
        "Realizar simulação MOC (Método das Características) completa"
      ));
    } else {
      results.push(check(
        "Simulação MOC", `DN ${input.diameter}mm — simulação MOC realizada`,
        "CAESB NTS 182 §8.1", "ok", "Realizada", "Obrigatória"
      ));
    }
  }

  // 2. Surge pressure
  const surgePercent = ((input.maxPressure - input.steadyPressure) / input.steadyPressure);
  if (surgePercent > CAESB_TRANSIENT.maxSurgePercent) {
    results.push(check(
      "Sobrepressão", `Sobrepressão de ${(surgePercent * 100).toFixed(0)}% > limite CAESB (${CAESB_TRANSIENT.maxSurgePercent * 100}%)`,
      "CAESB NTS 182 §8.3", "critical",
      `${(surgePercent * 100).toFixed(0)}%`, `≤ ${CAESB_TRANSIENT.maxSurgePercent * 100}%`,
      "Instalar dispositivo antitransiente (TAU, ventosa, câmara de ar)"
    ));
  } else {
    results.push(check(
      "Sobrepressão", `Sobrepressão de ${(surgePercent * 100).toFixed(0)}% dentro do limite`,
      "CAESB NTS 182 §8.3", "ok",
      `${(surgePercent * 100).toFixed(0)}%`, `≤ ${CAESB_TRANSIENT.maxSurgePercent * 100}%`
    ));
  }

  // 3. Minimum pressure (cavitation)
  if (input.minPressure < CAESB_TRANSIENT.minPressureAllowed) {
    results.push(check(
      "Subpressão / Cavitação", `Pressão mínima ${input.minPressure.toFixed(1)} mca — RISCO DE CAVITAÇÃO`,
      "CAESB NTS 182 §8.4 / NBR 12215", "critical",
      `${input.minPressure.toFixed(1)} mca`, `≥ ${CAESB_TRANSIENT.minPressureAllowed} mca`,
      "Instalar ventosa de admissão de ar ou câmara de ar"
    ));
  }

  // 4. Pressure class validation
  const requiredPN = Math.ceil(input.maxPressure / 10) * 10;
  if (input.pressureClass < requiredPN) {
    results.push(check(
      "Classe de Pressão", `PN ${input.pressureClass} < necessário PN ${requiredPN}`,
      "CAESB NTS 182 §7.2", "critical",
      `PN ${input.pressureClass}`, `≥ PN ${requiredPN}`,
      `Utilizar tubulação classe PN ${requiredPN} ou superior`
    ));
  } else {
    results.push(check(
      "Classe de Pressão", `PN ${input.pressureClass} atende pressão máxima de ${input.maxPressure.toFixed(0)} mca`,
      "CAESB NTS 182 §7.2", "ok",
      `PN ${input.pressureClass}`, `≥ PN ${requiredPN}`
    ));
  }

  // 5. Protection devices
  if (input.maxPressure > input.steadyPressure * 1.3 && !input.hasProtectionDevices) {
    results.push(check(
      "Dispositivos de Proteção", "Sobrepressão > 30% sem dispositivos de proteção",
      "CAESB NTS 182 §8.5", "warning",
      "Ausentes", "Recomendados",
      "Considerar: válvula antecipadora de onda, TAU, câmara de ar, ventosa"
    ));
  }

  // 6. Critical time
  const Tc = (2 * input.length) / input.waveSpeed;
  if (input.closureTime < Tc) {
    results.push(check(
      "Tempo Crítico", `Fechamento em ${input.closureTime.toFixed(1)}s < Tc=${Tc.toFixed(1)}s — golpe total`,
      "NBR 12215 §9.2", "critical",
      `${input.closureTime.toFixed(1)}s`, `≥ ${Tc.toFixed(1)}s`,
      `Aumentar tempo de fechamento para ≥ ${Tc.toFixed(1)}s ou usar fechamento lento`
    ));
  }

  return results;
}

// ══════════════════════════════════════
// Elevator Station Checks
// ══════════════════════════════════════

export function checkElevatorStation(input: ElevatorStationInput): CAESBCheckResult[] {
  checkIdCounter = 0;
  const results: CAESBCheckResult[] = [];
  const isWater = input.networkType === "agua";

  // 1. Suction velocity
  const suctionMax = isWater
    ? CAESB_ELEVATOR.suctionVelocityMaxWater
    : CAESB_ELEVATOR.suctionVelocityMaxSewer;
  if (input.suctionVelocity > suctionMax) {
    results.push(check(
      "Velocidade de Sucção", `${input.suctionVelocity.toFixed(2)} m/s > máximo ${suctionMax} m/s`,
      "CAESB NTS 182 §6.2 / NBR 12214", "critical",
      `${input.suctionVelocity.toFixed(2)} m/s`, `≤ ${suctionMax} m/s`,
      "Aumentar diâmetro da tubulação de sucção"
    ));
  } else {
    results.push(check(
      "Velocidade de Sucção", `${input.suctionVelocity.toFixed(2)} m/s dentro do limite`,
      "CAESB NTS 182 §6.2", "ok",
      `${input.suctionVelocity.toFixed(2)} m/s`, `≤ ${suctionMax} m/s`
    ));
  }

  // 2. Discharge velocity
  const dischMin = isWater
    ? CAESB_ELEVATOR.dischargeVelocityMinWater
    : CAESB_ELEVATOR.dischargeVelocityMinSewer;
  const dischMax = isWater
    ? CAESB_ELEVATOR.dischargeVelocityMaxWater
    : CAESB_ELEVATOR.dischargeVelocityMaxSewer;
  if (input.dischargeVelocity < dischMin || input.dischargeVelocity > dischMax) {
    results.push(check(
      "Velocidade de Recalque", `${input.dischargeVelocity.toFixed(2)} m/s fora da faixa`,
      "CAESB NTS 182 §6.3 / NBR 12214", "warning",
      `${input.dischargeVelocity.toFixed(2)} m/s`, `${dischMin} - ${dischMax} m/s`,
      "Ajustar diâmetro da tubulação de recalque"
    ));
  }

  // 3. NPSH
  const npshMargin = input.npshAvailable - input.npshRequired;
  if (npshMargin < CAESB_ELEVATOR.npshMargin) {
    results.push(check(
      "NPSH", `Margem NPSH = ${npshMargin.toFixed(2)}m < mínimo ${CAESB_ELEVATOR.npshMargin}m`,
      "CAESB NTS 182 §6.5 / NBR 12214", "critical",
      `${npshMargin.toFixed(2)}m`, `≥ ${CAESB_ELEVATOR.npshMargin}m`,
      "Reduzir perdas na sucção ou abaixar bomba (afogamento)"
    ));
  } else {
    results.push(check(
      "NPSH", `Margem NPSH = ${npshMargin.toFixed(2)}m — sem risco de cavitação`,
      "CAESB NTS 182 §6.5", "ok",
      `${npshMargin.toFixed(2)}m`, `≥ ${CAESB_ELEVATOR.npshMargin}m`
    ));
  }

  // 4. Reserve pumps
  const minReserve = isWater
    ? CAESB_ELEVATOR.minReservePumps
    : CAESB_ELEVATOR.minReservePumpsSewer;
  if (input.numReserve < minReserve) {
    results.push(check(
      "Bomba Reserva", `${input.numReserve} bomba(s) reserva < mínimo ${minReserve}`,
      input.networkType === "esgoto" ? "NBR 12209 §6.3" : "CAESB NTS 182 §6.1",
      "critical",
      `${input.numReserve}`, `≥ ${minReserve}`,
      `Prever no mínimo ${minReserve} bomba(s) reserva`
    ));
  }

  // 5. Efficiency
  if (input.efficiency < 60) {
    results.push(check(
      "Rendimento da Bomba", `Rendimento ${input.efficiency}% < 60% — baixa eficiência`,
      "CAESB NTS 182 §6.4", "warning",
      `${input.efficiency}%`, `≥ 60%`,
      "Verificar ponto de operação na curva da bomba. Considerar VFD."
    ));
  }

  return results;
}

// ══════════════════════════════════════
// Full Report Generator
// ══════════════════════════════════════

export function generateCAESBReport(
  networkType: NetworkType,
  checks: CAESBCheckResult[],
): CAESBComplianceReport {
  const critical = checks.filter(c => c.severity === "critical").length;
  const warnings = checks.filter(c => c.severity === "warning").length;
  const passed = checks.filter(c => c.severity === "ok").length;

  let overallStatus: CAESBComplianceReport["overallStatus"];
  if (critical > 0) {
    overallStatus = "reprovado";
  } else if (warnings > 0) {
    overallStatus = "com_ressalvas";
  } else {
    overallStatus = "aprovado";
  }

  return {
    networkType,
    totalChecks: checks.length,
    passed,
    warnings,
    critical,
    checks,
    overallStatus,
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════
// Checklist for document submission
// ══════════════════════════════════════

export interface CAESBDocumentItem {
  id: number;
  document: string;
  required: boolean;
  normReference: string;
  description: string;
}

export function getCAESBSubmissionChecklist(networkType: NetworkType): CAESBDocumentItem[] {
  const common: CAESBDocumentItem[] = [
    { id: 1, document: "Memorial Descritivo", required: true, normReference: "CAESB NTS §2.1", description: "Descritivo completo do projeto com justificativas técnicas" },
    { id: 2, document: "Memorial de Cálculo", required: true, normReference: "CAESB NTS §2.2", description: "Memória de cálculo hidráulico com todas as fórmulas e parâmetros" },
    { id: 3, document: "Planta Geral", required: true, normReference: "CAESB NTS §3.1", description: "Planta de situação e locação em escala adequada" },
    { id: 4, document: "Perfil Longitudinal", required: true, normReference: "CAESB NTS §3.2", description: "Perfil com cotas de terreno, greide e linha piezométrica" },
    { id: 5, document: "ART/RRT", required: true, normReference: "Lei 6.496/77", description: "Anotação de Responsabilidade Técnica do projetista" },
    { id: 6, document: "Planilha de Quantitativos", required: true, normReference: "CAESB NTS §4.1", description: "Quantitativos detalhados de materiais e serviços" },
    { id: 7, document: "Orçamento (base SINAPI)", required: true, normReference: "CAESB NTS §4.2 / TCU", description: "Orçamento baseado em SINAPI/SICRO com BDI conforme TCU" },
    { id: 8, document: "Cronograma Físico-Financeiro", required: true, normReference: "CAESB NTS §4.3", description: "Cronograma de execução com curva S" },
  ];

  const sewerSpecific: CAESBDocumentItem[] = [
    { id: 9, document: "Planilha de Dimensionamento Hidráulico", required: true, normReference: "CAESB NTS 183 / NBR 9649", description: "Todos os trechos com DN, declividade, vazão, velocidade, tensão trativa, Y/D" },
    { id: 10, document: "Detalhes dos PVs e TILs", required: true, normReference: "CAESB NTS 183 §6", description: "Detalhamento de poços de visita e terminais de limpeza" },
    { id: 11, document: "Estudo de Contribuição de Esgoto", required: true, normReference: "CAESB NTS 183 §3", description: "Cálculo da vazão de contribuição por trecho" },
  ];

  const waterSpecific: CAESBDocumentItem[] = [
    { id: 9, document: "Modelagem Hidráulica (EPANET)", required: true, normReference: "CAESB NTS 181 §5", description: "Simulação de rede com EPANET ou similar" },
    { id: 10, document: "Análise de Pressões", required: true, normReference: "CAESB NTS 181 §4.2", description: "Mapa de pressões estáticas e dinâmicas" },
    { id: 11, document: "Estudo de Demanda", required: true, normReference: "CAESB NTS 181 §3", description: "Estudo de demanda per capita e vazão de projeto" },
  ];

  const transientSpecific: CAESBDocumentItem[] = [
    { id: 12, document: "Estudo de Transientes (MOC)", required: true, normReference: "CAESB NTS 182 §8 / NBR 12215", description: "Simulação MOC completa obrigatória para DN ≥ 300mm" },
    { id: 13, document: "Especificação de Proteções", required: true, normReference: "CAESB NTS 182 §8.5", description: "Especificação de dispositivos antitransiente (ventosa, TAU, câmara de ar)" },
    { id: 14, document: "Envoltória de Pressões", required: true, normReference: "NBR 12215 §9", description: "Gráfico de envoltória de pressões máximas e mínimas" },
  ];

  switch (networkType) {
    case "esgoto": return [...common, ...sewerSpecific];
    case "agua": return [...common, ...waterSpecific];
    case "adutora": return [...common, ...waterSpecific, ...transientSpecific];
    case "elevatoria": return [...common, ...transientSpecific];
    default: return common;
  }
}
