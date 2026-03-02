/**
 * Hydraulic Transient Engine — Water Hammer (Golpe de Aríete) Simulation
 *
 * Implements the Method of Characteristics (MOC) for solving transient
 * hydraulic problems in pressurized pipe systems.
 *
 * Based on:
 * - Joukowsky equation: ΔP = ρ·a·ΔV
 * - Continuity and momentum equations
 * - NBR 12215:2017 (Adutoras)
 * - NBR 12214:2020 (Sistemas de bombeamento)
 * - AWWA M11 (Steel Pipe Design)
 * - CAESB technical standards
 *
 * References:
 * - Wylie & Streeter, "Fluid Transients in Systems"
 * - Chaudhry, "Applied Hydraulic Transients"
 * - TSNet (Python transient simulation library)
 * - Allievi (classical water hammer theory)
 */

const GRAVITY = 9.81;
const PI = Math.PI;
const WATER_DENSITY = 998.2; // kg/m³ at 20°C
const WATER_BULK_MODULUS = 2.19e9; // Pa (bulk modulus of water)
const VAPOR_PRESSURE = 2340; // Pa (absolute) at 20°C

// ══════════════════════════════════════
// Types
// ══════════════════════════════════════

export interface TransientPipe {
  id: string;
  /** Upstream node ID */
  nodeUp: string;
  /** Downstream node ID */
  nodeDown: string;
  /** Length (m) */
  length: number;
  /** Internal diameter (mm) */
  diameter: number;
  /** Wall thickness (mm) */
  wallThickness: number;
  /** Darcy-Weisbach friction factor */
  frictionFactor: number;
  /** Pipe material */
  material: PipeMaterial;
  /** Hazen-Williams roughness coefficient */
  roughnessHW?: number;
  /** Wave speed override (m/s). If not set, computed from material & geometry */
  waveSpeed?: number;
}

export interface TransientNode {
  id: string;
  /** Elevation (m) */
  elevation: number;
  /** Node type */
  type: TransientNodeType;
}

export type TransientNodeType =
  | "junction"
  | "reservoir"
  | "dead_end"
  | "pump"
  | "valve";

export type PipeMaterial =
  | "PVC"
  | "PEAD"
  | "FoFo"
  | "Aco"
  | "Concreto"
  | "PRFV";

/** Material properties: [Young's modulus (Pa), Poisson's ratio] */
const MATERIAL_PROPS: Record<PipeMaterial, [number, number]> = {
  PVC: [3.0e9, 0.45],
  PEAD: [0.8e9, 0.46],
  FoFo: [1.0e11, 0.28],
  Aco: [2.07e11, 0.30],
  Concreto: [2.5e10, 0.20],
  PRFV: [1.0e10, 0.35],
};

export interface PumpData {
  /** Node ID where pump is located */
  nodeId: string;
  /** Rated flow (m³/s) */
  ratedFlow: number;
  /** Rated head (m) */
  ratedHead: number;
  /** Rated speed (rpm) */
  ratedSpeed: number;
  /** Pump moment of inertia WR² (kg·m²) */
  inertia: number;
  /** Pump curve points [Q (m³/s), H (m)] */
  curve: [number, number][];
  /** Check valve present */
  hasCheckValve: boolean;
}

export interface ValveData {
  /** Node ID where valve is located */
  nodeId: string;
  /** Valve type */
  valveType: "gate" | "butterfly" | "check" | "relief" | "air";
  /** Initial opening (0-1) */
  initialOpening: number;
  /** Closure/opening time (s) */
  operationTime: number;
  /** Closure law: linear or parabolic */
  closureLaw: "linear" | "parabolic";
  /** Cv (valve coefficient) at full open */
  cv: number;
}

export interface SurgeProtection {
  /** Type of protection device */
  type: "air_chamber" | "surge_tank" | "relief_valve" | "air_valve" | "flywheel";
  /** Node ID */
  nodeId: string;
  /** Volume (m³) for air chamber/surge tank */
  volume?: number;
  /** Initial air volume (m³) for air chamber */
  airVolume?: number;
  /** Initial pressure (m) for air chamber */
  initialPressure?: number;
  /** Relief valve set pressure (m) */
  setPressure?: number;
  /** Tank diameter (m) for surge tank */
  tankDiameter?: number;
  /** Flywheel inertia (kg·m²) */
  flywheelInertia?: number;
}

export interface TransientScenario {
  /** Scenario name */
  name: string;
  /** Type of event */
  eventType: "pump_trip" | "pump_start" | "valve_closure" | "valve_opening" | "power_failure";
  /** Simulation duration (s) */
  duration: number;
  /** Time step (s). If 0, automatically computed from Courant condition */
  timeStep: number;
  /** Event start time (s) */
  eventTime: number;
}

export interface TransientInput {
  pipes: TransientPipe[];
  nodes: TransientNode[];
  pumps: PumpData[];
  valves: ValveData[];
  protections: SurgeProtection[];
  scenario: TransientScenario;
  /** Steady-state flow (m³/s) */
  steadyStateFlow: number;
  /** Steady-state pressure at pump discharge (m) */
  steadyStatePressure: number;
}

// ══════════════════════════════════════
// Results
// ══════════════════════════════════════

export interface TransientResult {
  /** Time series at each node: [time (s), head (m)] */
  nodeHeads: Map<string, [number, number][]>;
  /** Time series at each pipe: [time (s), flow (m³/s)] */
  pipeFlows: Map<string, [number, number][]>;
  /** Envelope: max and min pressure at each node */
  envelope: {
    nodeId: string;
    maxHead: number;
    minHead: number;
    steadyHead: number;
    elevation: number;
    maxPressure: number;
    minPressure: number;
  }[];
  /** Envelope along each pipe (for profile) */
  pipeEnvelope: {
    pipeId: string;
    stations: {
      distance: number;
      elevation: number;
      maxHead: number;
      minHead: number;
      steadyHead: number;
    }[];
  }[];
  /** Global extremes */
  maxPressure: number;
  minPressure: number;
  maxVelocity: number;
  /** Joukowsky surge (m) */
  joukowskySurge: number;
  /** Wave speeds by pipe */
  waveSpeeds: { pipeId: string; waveSpeed: number }[];
  /** Cavitation risk locations */
  cavitationRisk: { nodeId: string; minPressure: number; time: number }[];
  /** Simulation metadata */
  converged: boolean;
  timeSteps: number;
  simulationTime: number;
  warnings: string[];
}

// ══════════════════════════════════════
// Wave speed calculation
// ══════════════════════════════════════

/**
 * Calculate wave propagation speed (celerity) in a pipe.
 *
 * a = √(K/ρ / (1 + (K·D)/(E·e)·c1))
 *
 * Where:
 * - K = bulk modulus of fluid (Pa)
 * - ρ = fluid density (kg/m³)
 * - D = pipe inner diameter (m)
 * - E = pipe Young's modulus (Pa)
 * - e = wall thickness (m)
 * - c1 = restraint factor (1.0 for thin-walled, anchored)
 */
export function calculateWaveSpeed(
  diameter: number,
  wallThickness: number,
  material: PipeMaterial,
): number {
  const [E] = MATERIAL_PROPS[material] || MATERIAL_PROPS.PVC;
  const D = diameter / 1000; // mm → m
  const e = wallThickness / 1000; // mm → m

  if (e <= 0 || D <= 0) return 1000; // fallback

  const c1 = 1.0; // thin-walled pipe anchored against movement
  const denominator = 1.0 + (WATER_BULK_MODULUS * D) / (E * e) * c1;
  const a = Math.sqrt(WATER_BULK_MODULUS / WATER_DENSITY / denominator);

  return Math.round(a * 10) / 10;
}

/**
 * Joukowsky equation: ΔH = a·ΔV/g
 * Maximum instantaneous pressure surge for complete and sudden flow stoppage.
 */
export function joukowskySurge(waveSpeed: number, velocity: number): number {
  return (waveSpeed * Math.abs(velocity)) / GRAVITY;
}

/**
 * Critical time for valve closure: Tc = 2L/a
 * If closure time < Tc, the surge is "fast" (full Joukowsky).
 */
export function criticalTime(pipeLength: number, waveSpeed: number): number {
  return (2 * pipeLength) / waveSpeed;
}

/**
 * Allievi pressure for slow closure: ΔH = a·V₀/(g·Tc) · t_close
 * (linear closure over time > critical time)
 */
export function allieviSurge(
  waveSpeed: number,
  velocity: number,
  closureTime: number,
  pipeLength: number,
): number {
  const Tc = criticalTime(pipeLength, waveSpeed);
  if (closureTime <= Tc) {
    // Fast closure: full Joukowsky
    return joukowskySurge(waveSpeed, velocity);
  }
  // Slow closure: reduced surge
  return joukowskySurge(waveSpeed, velocity) * (Tc / closureTime);
}

// ══════════════════════════════════════
// Friction models
// ══════════════════════════════════════

/** Darcy-Weisbach friction head loss per unit length */
function frictionGradient(f: number, V: number, D: number): number {
  if (D <= 0) return 0;
  return (f * V * Math.abs(V)) / (2 * GRAVITY * D);
}

/** Pipe area from diameter in mm */
function pipeArea(diamMm: number): number {
  const D = diamMm / 1000;
  return (PI * D * D) / 4;
}

// ══════════════════════════════════════
// MOC Solver — Method of Characteristics
// ══════════════════════════════════════

interface MOCSection {
  pipeId: string;
  /** Number of computational sections in this pipe */
  N: number;
  /** Section length (m) */
  dx: number;
  /** Wave speed (m/s) */
  a: number;
  /** Friction factor */
  f: number;
  /** Diameter (m) */
  D: number;
  /** Area (m²) */
  A: number;
  /** Characteristic impedance B = a/(g·A) */
  B: number;
  /** Friction term R = f·dx/(2·g·D·A²) */
  R: number;
  /** Head at each section [0..N] at current and previous time step */
  H: Float64Array;
  Hprev: Float64Array;
  /** Flow at each section [0..N] at current and previous time step */
  Q: Float64Array;
  Qprev: Float64Array;
  /** Elevation at each section */
  elev: Float64Array;
  /** Upstream/downstream node IDs */
  nodeUp: string;
  nodeDown: string;
}

/**
 * Run a transient hydraulic simulation using the Method of Characteristics.
 *
 * The MOC transforms the partial differential equations of unsteady pipe
 * flow into ordinary differential equations along characteristic lines
 * C+ and C-, enabling a stable explicit time-marching scheme.
 *
 * Compatibility equations:
 * C+: Hp = Cp - Bp·Qp  where Cp = H[i-1] + B·Q[i-1], Bp = B + R·|Q[i-1]|
 * C-: Hp = Cm + Bm·Qp  where Cm = H[i+1] - B·Q[i+1], Bm = B + R·|Q[i+1]|
 *
 * At interior points: Qp = (Cp - Cm)/(Bp + Bm), Hp = Cp - Bp·Qp
 */
export function runTransientSimulation(input: TransientInput): TransientResult {
  const warnings: string[] = [];
  const startTime = performance.now();

  // ── Step 1: Calculate wave speeds ──
  const waveSpeeds: { pipeId: string; waveSpeed: number }[] = [];
  const pipeWaveSpeed = new Map<string, number>();

  for (const pipe of input.pipes) {
    const a = pipe.waveSpeed || calculateWaveSpeed(pipe.diameter, pipe.wallThickness, pipe.material);
    pipeWaveSpeed.set(pipe.id, a);
    waveSpeeds.push({ pipeId: pipe.id, waveSpeed: a });
  }

  // ── Step 2: Determine time step (Courant condition) ──
  let dt = input.scenario.timeStep;
  if (dt <= 0) {
    // Auto-compute: dt = min(dx/a) across all pipes, with N segments per pipe
    let minRatio = Infinity;
    for (const pipe of input.pipes) {
      const a = pipeWaveSpeed.get(pipe.id)!;
      const N = Math.max(Math.ceil(pipe.length / (a * 0.1)), 4); // at least 4 segments
      const dx = pipe.length / N;
      minRatio = Math.min(minRatio, dx / a);
    }
    dt = minRatio * 0.95; // Courant number < 1
  }

  if (dt <= 0) dt = 0.01;

  const totalSteps = Math.ceil(input.scenario.duration / dt);
  const maxSteps = 100000;
  if (totalSteps > maxSteps) {
    dt = input.scenario.duration / maxSteps;
    warnings.push(`Passo de tempo ajustado para ${dt.toFixed(4)}s (máximo ${maxSteps} passos)`);
  }

  // ── Step 3: Build pipe sections ──
  const nodeMap = new Map(input.nodes.map(n => [n.id, n]));
  const sections: MOCSection[] = [];

  for (const pipe of input.pipes) {
    const a = pipeWaveSpeed.get(pipe.id)!;
    const N = Math.max(Math.round(pipe.length / (a * dt)), 2);
    const dx = pipe.length / N;
    const D = pipe.diameter / 1000;
    const A = pipeArea(pipe.diameter);
    const f = pipe.frictionFactor;
    const B = a / (GRAVITY * A);
    const R = (f * dx) / (2 * GRAVITY * D * A * A);

    const upNode = nodeMap.get(pipe.nodeUp);
    const downNode = nodeMap.get(pipe.nodeDown);
    const elevUp = upNode?.elevation ?? 0;
    const elevDown = downNode?.elevation ?? 0;

    // Interpolate elevation along pipe
    const elev = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      elev[i] = elevUp + (elevDown - elevUp) * (i / N);
    }

    sections.push({
      pipeId: pipe.id,
      N,
      dx,
      a,
      f,
      D,
      A,
      B,
      R,
      H: new Float64Array(N + 1),
      Hprev: new Float64Array(N + 1),
      Q: new Float64Array(N + 1),
      Qprev: new Float64Array(N + 1),
      elev,
      nodeUp: pipe.nodeUp,
      nodeDown: pipe.nodeDown,
    });
  }

  // ── Step 4: Set initial conditions (steady state) ──
  const Q0 = input.steadyStateFlow;
  const H0 = input.steadyStatePressure;

  // Compute steady-state head along each pipe (including friction losses)
  for (const sec of sections) {
    const V0 = Q0 / sec.A;
    const Sf = frictionGradient(sec.f, V0, sec.D); // friction slope
    const upNode = nodeMap.get(sec.nodeUp);
    const headAtUpstream = upNode?.type === "pump"
      ? H0 + (upNode?.elevation ?? 0)
      : H0 + (upNode?.elevation ?? 0);

    for (let i = 0; i <= sec.N; i++) {
      sec.Q[i] = Q0;
      sec.Qprev[i] = Q0;
      // Head decreases due to friction along pipe
      sec.H[i] = headAtUpstream - Sf * sec.dx * i;
      sec.Hprev[i] = sec.H[i];
    }
  }

  // ── Step 5: Time-marching ──
  const nodeHeadSeries = new Map<string, [number, number][]>();
  const pipeFlowSeries = new Map<string, [number, number][]>();

  // Initialize time series
  for (const node of input.nodes) {
    nodeHeadSeries.set(node.id, [[0, H0 + node.elevation]]);
  }
  for (const pipe of input.pipes) {
    pipeFlowSeries.set(pipe.id, [[0, Q0]]);
  }

  // Track envelope
  const nodeMaxHead = new Map<string, number>();
  const nodeMinHead = new Map<string, number>();

  for (const node of input.nodes) {
    const initialHead = H0 + node.elevation;
    nodeMaxHead.set(node.id, initialHead);
    nodeMinHead.set(node.id, initialHead);
  }

  // Pump state
  let pumpSpeedRatio = 1.0; // N/N_rated (0-1)
  let pumpFlowRatio = 1.0;

  // Valve state
  const valveOpenings = new Map<string, number>();
  for (const v of input.valves) {
    valveOpenings.set(v.nodeId, v.initialOpening);
  }

  const actualSteps = Math.min(totalSteps, maxSteps);
  const recordInterval = Math.max(1, Math.floor(actualSteps / 2000)); // Max ~2000 data points

  for (let step = 1; step <= actualSteps; step++) {
    const t = step * dt;

    // ── Update boundary conditions ──

    // Pump trip / power failure
    if (input.scenario.eventType === "pump_trip" || input.scenario.eventType === "power_failure") {
      if (t >= input.scenario.eventTime) {
        const pump = input.pumps[0];
        if (pump) {
          const elapsed = t - input.scenario.eventTime;
          // Exponential pump speed decay: N(t) = N0 · exp(-t/τ)
          // τ based on pump inertia: τ = WR² · N_rated / (30 · T_brake)
          const tau = pump.inertia > 0
            ? pump.inertia * pump.ratedSpeed / (30 * WATER_DENSITY * GRAVITY * pump.ratedFlow * pump.ratedHead / (pump.ratedSpeed * PI / 30))
            : 2.0; // default 2s
          pumpSpeedRatio = Math.max(0, Math.exp(-elapsed / Math.max(tau, 0.1)));
          pumpFlowRatio = pumpSpeedRatio; // affinity law: Q ∝ N
        }
      }
    }

    // Pump start
    if (input.scenario.eventType === "pump_start") {
      if (t >= input.scenario.eventTime) {
        const elapsed = t - input.scenario.eventTime;
        // Linear ramp-up over 10 seconds
        pumpSpeedRatio = Math.min(1.0, elapsed / 10.0);
        pumpFlowRatio = pumpSpeedRatio;
      } else {
        pumpSpeedRatio = 0;
        pumpFlowRatio = 0;
      }
    }

    // Valve closure/opening
    for (const v of input.valves) {
      if (t >= input.scenario.eventTime) {
        const elapsed = t - input.scenario.eventTime;
        const progress = Math.min(1.0, elapsed / Math.max(v.operationTime, 0.01));

        if (input.scenario.eventType === "valve_closure") {
          if (v.closureLaw === "parabolic") {
            valveOpenings.set(v.nodeId, v.initialOpening * (1 - progress) * (1 - progress));
          } else {
            valveOpenings.set(v.nodeId, v.initialOpening * (1 - progress));
          }
        } else if (input.scenario.eventType === "valve_opening") {
          valveOpenings.set(v.nodeId, v.initialOpening * progress);
        }
      }
    }

    // ── MOC interior points ──
    for (const sec of sections) {
      // Swap buffers
      const tmpH = sec.Hprev;
      sec.Hprev = sec.H;
      sec.H = tmpH;
      const tmpQ = sec.Qprev;
      sec.Qprev = sec.Q;
      sec.Q = tmpQ;

      // Interior points (1 .. N-1)
      for (let i = 1; i < sec.N; i++) {
        // C+ line (from upstream): Cp = H[i-1] + B·Q[i-1]
        const Cp = sec.Hprev[i - 1] + sec.B * sec.Qprev[i - 1];
        const Bp = sec.B + sec.R * Math.abs(sec.Qprev[i - 1]);

        // C- line (from downstream): Cm = H[i+1] - B·Q[i+1]
        const Cm = sec.Hprev[i + 1] - sec.B * sec.Qprev[i + 1];
        const Bm = sec.B + sec.R * Math.abs(sec.Qprev[i + 1]);

        sec.Q[i] = (Cp - Cm) / (Bp + Bm);
        sec.H[i] = Cp - Bp * sec.Q[i];
      }
    }

    // ── Boundary conditions ──
    for (const sec of sections) {
      const upNode = nodeMap.get(sec.nodeUp);
      const downNode = nodeMap.get(sec.nodeDown);

      // Upstream boundary
      if (upNode) {
        if (upNode.type === "reservoir") {
          // Constant head reservoir
          sec.H[0] = sec.Hprev[0]; // reservoir head is constant
          // C- from first interior point
          const Cm = sec.Hprev[1] - sec.B * sec.Qprev[1];
          const Bm = sec.B + sec.R * Math.abs(sec.Qprev[1]);
          sec.Q[0] = (sec.H[0] - Cm) / Bm;
        } else if (upNode.type === "pump") {
          // Pump boundary: apply speed ratio
          const pump = input.pumps.find(p => p.nodeId === upNode.id);
          // C- compatibility from section
          const Cm = sec.Hprev[1] - sec.B * sec.Qprev[1];
          const Bm = sec.B + sec.R * Math.abs(sec.Qprev[1]);

          if (pump) {
            if (pump.hasCheckValve && pumpFlowRatio <= 0.01) {
              // Check valve closed: zero flow
              sec.Q[0] = 0;
              sec.H[0] = Cm;
            } else {
              // Simplified pump model: H = H_rated · α² - (H_rated/Q_rated²) · Q²
              // where α = N/N_rated
              const alpha = pumpSpeedRatio;
              const Hr = pump.ratedHead * alpha * alpha;
              const Qr = pump.ratedFlow * alpha;
              // Intersect pump curve with C- line
              // Hp = Hr - (Hr/Qr²)·Qp² and Hp = Cm + Bm·Qp
              // Solve: Cm + Bm·Q = Hr - (Hr/Qr²)·Q²
              if (Qr > 0) {
                const k = pump.ratedHead / (pump.ratedFlow * pump.ratedFlow);
                // k·Q² + Bm·Q + (Cm - Hr) = 0
                const aa = k;
                const bb = Bm;
                const cc = Cm - Hr;
                const disc = bb * bb - 4 * aa * cc;
                if (disc >= 0) {
                  sec.Q[0] = (-bb + Math.sqrt(disc)) / (2 * aa);
                  if (sec.Q[0] < 0) sec.Q[0] = 0;
                } else {
                  sec.Q[0] = 0;
                }
                sec.H[0] = Cm + Bm * sec.Q[0];
              } else {
                sec.Q[0] = 0;
                sec.H[0] = Cm;
              }
            }
          } else {
            // No pump data: treat as junction
            sec.H[0] = sec.Hprev[0];
            sec.Q[0] = (sec.H[0] - Cm) / Bm;
          }
        } else {
          // Junction or dead end: C+ from upstream pipe
          // For simplicity, use reservoir-like constant head for now
          const Cm = sec.Hprev[1] - sec.B * sec.Qprev[1];
          const Bm = sec.B + sec.R * Math.abs(sec.Qprev[1]);
          sec.H[0] = sec.Hprev[0];
          sec.Q[0] = (sec.H[0] - Cm) / Bm;
        }
      }

      // Downstream boundary
      if (downNode) {
        const N = sec.N;
        const Cp = sec.Hprev[N - 1] + sec.B * sec.Qprev[N - 1];
        const Bp = sec.B + sec.R * Math.abs(sec.Qprev[N - 1]);

        if (downNode.type === "reservoir") {
          sec.H[N] = sec.Hprev[N]; // constant
          sec.Q[N] = (Cp - sec.H[N]) / Bp;
        } else if (downNode.type === "dead_end") {
          sec.Q[N] = 0;
          sec.H[N] = Cp;
        } else {
          // Junction: check for valve
          const valve = input.valves.find(v => v.nodeId === downNode.id);
          if (valve) {
            const tau = valveOpenings.get(downNode.id) ?? 1.0;
            if (tau <= 0.001) {
              // Fully closed
              sec.Q[N] = 0;
              sec.H[N] = Cp;
            } else {
              // Valve equation: Q = Cv·τ·√(H)
              // Intersect with C+ line: Hp = Cp - Bp·Qp
              // Q = Cv·τ·√(Hp), so Cp - Bp·Q = (Q/(Cv·τ))²
              const CvTau = valve.cv * tau;
              if (CvTau > 0) {
                // Iterative solution
                let Qest = sec.Qprev[N];
                for (let iter = 0; iter < 20; iter++) {
                  const Hest = Cp - Bp * Qest;
                  if (Hest <= 0) { Qest = 0; break; }
                  const Qnew = CvTau * Math.sqrt(Hest);
                  if (Math.abs(Qnew - Qest) < 1e-8) break;
                  Qest = (Qest + Qnew) / 2;
                }
                sec.Q[N] = Math.max(0, Qest);
                sec.H[N] = Cp - Bp * sec.Q[N];
              } else {
                sec.Q[N] = 0;
                sec.H[N] = Cp;
              }
            }
          } else {
            // Simple outflow: assume constant head at downstream end
            sec.H[N] = sec.Hprev[N];
            sec.Q[N] = (Cp - sec.H[N]) / Bp;
          }
        }
      }
    }

    // ── Record time series ──
    if (step % recordInterval === 0 || step === 1 || step === actualSteps) {
      for (const sec of sections) {
        // Record upstream and downstream head
        const upSeries = nodeHeadSeries.get(sec.nodeUp);
        if (upSeries) upSeries.push([t, sec.H[0]]);

        const downSeries = nodeHeadSeries.get(sec.nodeDown);
        if (downSeries) downSeries.push([t, sec.H[sec.N]]);

        // Record flow
        const flowSeries = pipeFlowSeries.get(sec.pipeId);
        if (flowSeries) flowSeries.push([t, sec.Q[0]]);

        // Update envelope
        for (let i = 0; i <= sec.N; i++) {
          const nodeId = i === 0 ? sec.nodeUp : i === sec.N ? sec.nodeDown : `${sec.pipeId}_${i}`;
          const maxH = nodeMaxHead.get(nodeId);
          const minH = nodeMinHead.get(nodeId);
          if (maxH === undefined || sec.H[i] > maxH) nodeMaxHead.set(nodeId, sec.H[i]);
          if (minH === undefined || sec.H[i] < minH) nodeMinHead.set(nodeId, sec.H[i]);
        }
      }
    }
  }

  // ── Step 6: Build results ──
  const envelope: TransientResult["envelope"] = [];
  for (const node of input.nodes) {
    const maxH = nodeMaxHead.get(node.id) ?? 0;
    const minH = nodeMinHead.get(node.id) ?? 0;
    const steadyH = H0 + node.elevation;
    envelope.push({
      nodeId: node.id,
      maxHead: Math.round(maxH * 100) / 100,
      minHead: Math.round(minH * 100) / 100,
      steadyHead: Math.round(steadyH * 100) / 100,
      elevation: node.elevation,
      maxPressure: Math.round((maxH - node.elevation) * 100) / 100,
      minPressure: Math.round((minH - node.elevation) * 100) / 100,
    });
  }

  // Build pipe envelope (for longitudinal profile)
  const pipeEnvelope: TransientResult["pipeEnvelope"] = [];
  for (const sec of sections) {
    const stations: TransientResult["pipeEnvelope"][0]["stations"] = [];
    for (let i = 0; i <= sec.N; i++) {
      const distance = i * sec.dx;
      const nodeId = i === 0 ? sec.nodeUp : i === sec.N ? sec.nodeDown : `${sec.pipeId}_${i}`;
      stations.push({
        distance: Math.round(distance * 100) / 100,
        elevation: Math.round(sec.elev[i] * 100) / 100,
        maxHead: Math.round((nodeMaxHead.get(nodeId) ?? sec.H[i]) * 100) / 100,
        minHead: Math.round((nodeMinHead.get(nodeId) ?? sec.H[i]) * 100) / 100,
        steadyHead: Math.round(sec.Hprev[i] * 100) / 100,
      });
    }
    pipeEnvelope.push({ pipeId: sec.pipeId, stations });
  }

  // Cavitation risk
  const cavitationRisk: TransientResult["cavitationRisk"] = [];
  for (const node of input.nodes) {
    const minH = nodeMinHead.get(node.id) ?? 0;
    const minPressure = minH - node.elevation;
    if (minPressure < 0) {
      cavitationRisk.push({
        nodeId: node.id,
        minPressure: Math.round(minPressure * 100) / 100,
        time: 0, // simplified
      });
    }
  }

  // Global extremes
  let globalMaxP = -Infinity;
  let globalMinP = Infinity;
  let globalMaxV = 0;

  for (const e of envelope) {
    globalMaxP = Math.max(globalMaxP, e.maxPressure);
    globalMinP = Math.min(globalMinP, e.minPressure);
  }

  for (const sec of sections) {
    const V = Q0 / sec.A;
    globalMaxV = Math.max(globalMaxV, Math.abs(V));
  }

  // Joukowsky surge (reference)
  const refPipe = input.pipes[0];
  const refA = refPipe ? (pipeWaveSpeed.get(refPipe.id) ?? 1000) : 1000;
  const refV = refPipe ? Q0 / pipeArea(refPipe.diameter) : 0;
  const joukowsky = joukowskySurge(refA, refV);

  const simulationTime = performance.now() - startTime;

  return {
    nodeHeads: nodeHeadSeries,
    pipeFlows: pipeFlowSeries,
    envelope,
    pipeEnvelope,
    maxPressure: Math.round(globalMaxP * 100) / 100,
    minPressure: Math.round(globalMinP * 100) / 100,
    maxVelocity: Math.round(globalMaxV * 1000) / 1000,
    joukowskySurge: Math.round(joukowsky * 100) / 100,
    waveSpeeds,
    cavitationRisk,
    converged: true,
    timeSteps: actualSteps,
    simulationTime: Math.round(simulationTime),
    warnings,
  };
}

// ══════════════════════════════════════
// Quick analysis (no MOC needed)
// ══════════════════════════════════════

export interface QuickTransientResult {
  /** Wave speed (m/s) */
  waveSpeed: number;
  /** Joukowsky surge (mca) */
  joukowskySurge: number;
  /** Allievi surge (mca) for given closure time */
  allieviSurge: number;
  /** Critical time 2L/a (s) */
  criticalTime: number;
  /** Steady-state velocity (m/s) */
  velocity: number;
  /** Max pressure = steady + surge (mca) */
  maxPressure: number;
  /** Min pressure = steady - surge (mca) */
  minPressure: number;
  /** Pipe pressure class needed (PN in mca) */
  pressureClassNeeded: number;
  /** Cavitation risk */
  cavitationRisk: boolean;
  /** Closure type */
  closureType: "fast" | "slow";
  /** Recommendations */
  recommendations: string[];
}

/**
 * Quick transient analysis without full MOC simulation.
 * Uses Joukowsky and Allievi formulas for rapid assessment.
 */
export function quickTransientAnalysis(
  pipe: TransientPipe,
  steadyFlow: number, // m³/s
  steadyPressure: number, // mca at discharge
  closureTime: number, // seconds
): QuickTransientResult {
  const a = pipe.waveSpeed || calculateWaveSpeed(pipe.diameter, pipe.wallThickness, pipe.material);
  const A = pipeArea(pipe.diameter);
  const V = A > 0 ? steadyFlow / A : 0;
  const Tc = criticalTime(pipe.length, a);
  const isfast = closureTime <= Tc;

  const surge = isfast
    ? joukowskySurge(a, V)
    : allieviSurge(a, V, closureTime, pipe.length);

  const maxP = steadyPressure + surge;
  const minP = steadyPressure - surge;
  const cavitation = minP < 0;

  // Pressure class: round up to standard PN classes
  const pnClasses = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100];
  let pnNeeded = pnClasses[pnClasses.length - 1];
  for (const pn of pnClasses) {
    if (pn * 10 >= maxP) { // PN is in bar, convert to mca (×10)
      pnNeeded = pn;
      break;
    }
  }

  const recommendations: string[] = [];

  if (cavitation) {
    recommendations.push("RISCO DE CAVITAÇÃO: pressão mínima negativa. Instale ventosa ou câmara de ar.");
  }
  if (isfast) {
    recommendations.push(`Fechamento RÁPIDO (Tf=${closureTime.toFixed(1)}s < Tc=${Tc.toFixed(1)}s). Considere fechamento lento.`);
  }
  if (maxP > steadyPressure * 1.5) {
    recommendations.push("Sobrepressão > 50% da pressão estática. Considere dispositivos de proteção.");
  }
  if (surge > 50) {
    recommendations.push("Golpe de aríete severo. Recomenda-se válvula antecipadora de onda ou câmara de ar.");
  }

  // NBR 12215 compliance
  if (closureTime < Tc) {
    recommendations.push(`NBR 12215: tempo de fechamento deve ser ≥ ${Tc.toFixed(1)}s (2L/a) para evitar golpe total.`);
  }

  // CAESB requirements
  if (pipe.diameter >= 300) {
    recommendations.push("CAESB: adutora DN ≥ 300mm requer estudo completo de transientes (simulação MOC).");
  }

  return {
    waveSpeed: Math.round(a * 10) / 10,
    joukowskySurge: Math.round(joukowskySurge(a, V) * 100) / 100,
    allieviSurge: Math.round(surge * 100) / 100,
    criticalTime: Math.round(Tc * 100) / 100,
    velocity: Math.round(V * 1000) / 1000,
    maxPressure: Math.round(maxP * 100) / 100,
    minPressure: Math.round(minP * 100) / 100,
    pressureClassNeeded: pnNeeded,
    cavitationRisk: cavitation,
    closureType: isfast ? "fast" : "slow",
    recommendations,
  };
}

// ══════════════════════════════════════
// Bridge from EPANET/QWater data
// ══════════════════════════════════════

/**
 * Convert EPANET/QWater network data to transient simulation input.
 * This bridges the steady-state results from EPANET with the transient solver.
 */
export function buildTransientFromEpanet(
  pipes: {
    id: string;
    node1: string;
    node2: string;
    length: number;
    diameter: number;
    roughness: number;
    flow?: number;
  }[],
  nodes: { id: string; elevation: number; type: string; head?: number }[],
  pumpData?: PumpData,
  scenario?: Partial<TransientScenario>,
  pipeWallThickness?: number,
  pipeMaterial?: PipeMaterial,
): TransientInput {
  const material = pipeMaterial || "PVC";
  const wallThick = pipeWallThickness || estimateWallThickness(material);

  const transientPipes: TransientPipe[] = pipes.map(p => ({
    id: p.id,
    nodeUp: p.node1,
    nodeDown: p.node2,
    length: p.length,
    diameter: p.diameter,
    wallThickness: wallThick,
    frictionFactor: hwToFriction(p.roughness, p.diameter, p.flow ?? 0.01),
    material,
  }));

  const transientNodes: TransientNode[] = nodes.map(n => ({
    id: n.id,
    elevation: n.elevation,
    type: (n.type === "reservoir" ? "reservoir"
      : n.type === "pump" ? "pump"
      : "junction") as TransientNodeType,
  }));

  const pumps: PumpData[] = pumpData ? [pumpData] : [];
  const totalFlow = pipes.reduce((sum, p) => sum + Math.abs(p.flow ?? 0), 0) / Math.max(pipes.length, 1);
  const sourcePressure = nodes.find(n => n.type === "reservoir")?.head ?? 50;

  return {
    pipes: transientPipes,
    nodes: transientNodes,
    pumps,
    valves: [],
    protections: [],
    scenario: {
      name: scenario?.name || "Análise de Transiente",
      eventType: scenario?.eventType || "pump_trip",
      duration: scenario?.duration || 60,
      timeStep: scenario?.timeStep || 0,
      eventTime: scenario?.eventTime || 1,
    },
    steadyStateFlow: totalFlow / 1000, // L/s to m³/s
    steadyStatePressure: sourcePressure,
  };
}

/** Estimate wall thickness from material and common usage */
function estimateWallThickness(material: PipeMaterial): number {
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

/** Approximate Darcy-Weisbach friction from Hazen-Williams C */
function hwToFriction(C: number, diamMm: number, flowLps: number): number {
  if (C <= 0 || diamMm <= 0 || flowLps <= 0) return 0.02;
  const D = diamMm / 1000;
  const A = PI * D * D / 4;
  const V = (flowLps / 1000) / A;
  const Re = V * D / 1.01e-6;
  if (Re <= 0) return 0.02;
  // Swamee-Jain approximation
  const epsilon = (D / 3.7) * Math.pow(10, -(1 / (2 * Math.log10(Re))) - C / 140);
  const f = 0.25 / Math.pow(Math.log10(epsilon / (3.7 * D) + 5.74 / Math.pow(Re, 0.9)), 2);
  return Math.max(0.005, Math.min(0.1, isNaN(f) ? 0.02 : f));
}

// ══════════════════════════════════════
// Bridge from recalque (pumping) module
// ══════════════════════════════════════

/**
 * Build transient input directly from a pumping station (recalque) design.
 */
export function buildTransientFromRecalque(
  stationData: {
    vazaoProjeto: number; // L/s
    alturaGeometrica: number; // m
    comprimentoRecalque: number; // m
    diametroRecalque: number; // mm
    material: string;
    coefHW: number;
    rendimentoBomba: number;
    rpmBomba?: number;
    inerciaBomba?: number;
    temValvulaRetencao?: boolean;
  },
  scenario?: Partial<TransientScenario>,
): TransientInput {
  const mat = (stationData.material as PipeMaterial) || "PVC";
  const wallThick = estimateWallThickness(mat);
  const a = calculateWaveSpeed(stationData.diametroRecalque, wallThick, mat);
  const A = pipeArea(stationData.diametroRecalque);
  const V = A > 0 ? (stationData.vazaoProjeto / 1000) / A : 0;
  const Q = stationData.vazaoProjeto / 1000; // m³/s

  // Build simple two-node, one-pipe network
  const pipes: TransientPipe[] = [{
    id: "recalque",
    nodeUp: "bomba",
    nodeDown: "reservatorio",
    length: stationData.comprimentoRecalque,
    diameter: stationData.diametroRecalque,
    wallThickness: wallThick,
    frictionFactor: hwToFriction(stationData.coefHW, stationData.diametroRecalque, stationData.vazaoProjeto),
    material: mat,
    waveSpeed: a,
  }];

  const nodes: TransientNode[] = [
    { id: "bomba", elevation: 0, type: "pump" },
    { id: "reservatorio", elevation: stationData.alturaGeometrica, type: "reservoir" },
  ];

  const pumpHead = stationData.alturaGeometrica * 1.2; // estimate TDH
  const pumps: PumpData[] = [{
    nodeId: "bomba",
    ratedFlow: Q,
    ratedHead: pumpHead,
    ratedSpeed: stationData.rpmBomba || 1750,
    inertia: stationData.inerciaBomba || estimatePumpInertia(Q * 1000, pumpHead),
    curve: [
      [0, pumpHead * 1.3],
      [Q * 0.5, pumpHead * 1.1],
      [Q, pumpHead],
      [Q * 1.2, pumpHead * 0.8],
    ],
    hasCheckValve: stationData.temValvulaRetencao ?? true,
  }];

  return {
    pipes,
    nodes,
    pumps,
    valves: [],
    protections: [],
    scenario: {
      name: scenario?.name || "Parada Brusca de Bomba",
      eventType: scenario?.eventType || "pump_trip",
      duration: scenario?.duration || Math.max(20, 4 * stationData.comprimentoRecalque / a),
      timeStep: scenario?.timeStep || 0,
      eventTime: scenario?.eventTime || 1,
    },
    steadyStateFlow: Q,
    steadyStatePressure: pumpHead,
  };
}

/** Estimate pump inertia WR² from flow and head */
function estimatePumpInertia(flowLps: number, headM: number): number {
  // Empirical: WR² ≈ 0.03 × Q^0.6 × H^0.4 (kg·m²)
  return 0.03 * Math.pow(Math.max(flowLps, 1), 0.6) * Math.pow(Math.max(headM, 1), 0.4);
}
