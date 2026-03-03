/**
 * EPANET Runner — Bridge to epanet-js WASM library for hydraulic simulation.
 *
 * Builds EPANET .inp files from structured input and runs steady-state
 * or extended-period simulations using the epanet-js package.
 *
 * References:
 * - https://github.com/modelcreate/epanet-js
 * - EPANET 2.2 User Manual
 */

// ══════════════════════════════════════
// INP file builder (no WASM dependency)
// ══════════════════════════════════════

export interface EpanetJunction {
  id: string;
  elevation: number;  // m
  demand: number;     // L/s
  pattern?: string;
}

export interface EpanetReservoir {
  id: string;
  head: number;       // Total head (m)
}

export interface EpanetTank {
  id: string;
  elevation: number;
  initLevel: number;
  minLevel: number;
  maxLevel: number;
  diameter: number;   // m
}

export interface EpanetPipe {
  id: string;
  node1: string;
  node2: string;
  length: number;     // m
  diameter: number;   // mm
  roughness: number;  // C (HW) or epsilon (DW)
  status?: "OPEN" | "CLOSED" | "CV";
}

export interface EpanetPump {
  id: string;
  node1: string;
  node2: string;
  properties: string; // e.g., "HEAD 1" referencing a curve
}

export interface EpanetCurve {
  id: string;
  type: "PUMP" | "EFFICIENCY" | "VOLUME" | "HEADLOSS";
  points: [number, number][];
}

export interface EpanetOptions {
  headlossFormula?: "H-W" | "D-W" | "C-M";
  units?: "LPS" | "GPM" | "CMH";
  viscosity?: number;
  diffusivity?: number;
  specificGravity?: number;
  trials?: number;
  accuracy?: number;
  duration?: number;      // seconds (0 = steady-state)
  hydraulicTimestep?: number;
  patternTimestep?: number;
  reportTimestep?: number;
}

export interface EpanetInput {
  junctions: EpanetJunction[];
  reservoirs: EpanetReservoir[];
  tanks: EpanetTank[];
  pipes: EpanetPipe[];
  pumps: EpanetPump[];
  curves: EpanetCurve[];
  options: EpanetOptions;
}

/**
 * Build an EPANET .inp file string from structured input.
 * Compatible with epanet-js Workspace.writeFile().
 */
export function buildINPString(input: EpanetInput): string {
  const lines: string[] = [];
  const opts = {
    headlossFormula: "H-W",
    units: "LPS",
    viscosity: 1.0,
    diffusivity: 1.0,
    specificGravity: 1.0,
    trials: 200,
    accuracy: 0.001,
    duration: 0,
    hydraulicTimestep: 3600,
    patternTimestep: 3600,
    reportTimestep: 3600,
    ...input.options,
  };

  // [TITLE]
  lines.push("[TITLE]", "HydroNetwork EPANET Simulation", "");

  // [JUNCTIONS]
  lines.push("[JUNCTIONS]");
  lines.push(";ID\tElev\tDemand\tPattern");
  for (const j of input.junctions) {
    lines.push(`${j.id}\t${j.elevation.toFixed(2)}\t${j.demand.toFixed(4)}\t${j.pattern || ""}`);
  }
  lines.push("");

  // [RESERVOIRS]
  lines.push("[RESERVOIRS]");
  lines.push(";ID\tHead");
  for (const r of input.reservoirs) {
    lines.push(`${r.id}\t${r.head.toFixed(2)}`);
  }
  lines.push("");

  // [TANKS]
  lines.push("[TANKS]");
  lines.push(";ID\tElevation\tInitLevel\tMinLevel\tMaxLevel\tDiameter\tMinVol");
  for (const t of input.tanks) {
    lines.push(`${t.id}\t${t.elevation.toFixed(2)}\t${t.initLevel.toFixed(2)}\t${t.minLevel.toFixed(2)}\t${t.maxLevel.toFixed(2)}\t${t.diameter.toFixed(2)}\t0`);
  }
  lines.push("");

  // [PIPES]
  lines.push("[PIPES]");
  lines.push(";ID\tNode1\tNode2\tLength\tDiameter\tRoughness\tMinorLoss\tStatus");
  for (const p of input.pipes) {
    lines.push(`${p.id}\t${p.node1}\t${p.node2}\t${p.length.toFixed(2)}\t${p.diameter.toFixed(1)}\t${p.roughness}\t0\t${p.status || "OPEN"}`);
  }
  lines.push("");

  // [PUMPS]
  if (input.pumps.length > 0) {
    lines.push("[PUMPS]");
    lines.push(";ID\tNode1\tNode2\tProperties");
    for (const p of input.pumps) {
      lines.push(`${p.id}\t${p.node1}\t${p.node2}\t${p.properties}`);
    }
    lines.push("");
  }

  // [CURVES]
  if (input.curves.length > 0) {
    lines.push("[CURVES]");
    lines.push(";ID\tX-Value\tY-Value");
    for (const c of input.curves) {
      for (const [x, y] of c.points) {
        lines.push(`${c.id}\t${x}\t${y}`);
      }
    }
    lines.push("");
  }

  // [OPTIONS]
  lines.push("[OPTIONS]");
  lines.push(`Units\t${opts.units}`);
  lines.push(`Headloss\t${opts.headlossFormula}`);
  lines.push(`Viscosity\t${opts.viscosity}`);
  lines.push(`Specific Gravity\t${opts.specificGravity}`);
  lines.push(`Trials\t${opts.trials}`);
  lines.push(`Accuracy\t${opts.accuracy}`);
  lines.push("");

  // [TIMES]
  lines.push("[TIMES]");
  lines.push(`Duration\t${formatTime(opts.duration)}`);
  lines.push(`Hydraulic Timestep\t${formatTime(opts.hydraulicTimestep)}`);
  lines.push(`Pattern Timestep\t${formatTime(opts.patternTimestep)}`);
  lines.push(`Report Timestep\t${formatTime(opts.reportTimestep)}`);
  lines.push("");

  // [REPORT]
  lines.push("[REPORT]");
  lines.push("Status\tNo");
  lines.push("Summary\tNo");
  lines.push("Page\t0");
  lines.push("");

  // [END]
  lines.push("[END]");

  return lines.join("\n");
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:00`;
}

// ══════════════════════════════════════
// EPANET simulation runner
// ══════════════════════════════════════

export interface EpanetNodeResult {
  id: string;
  pressure: number;     // mca
  head: number;         // m
  demand: number;       // L/s
}

export interface EpanetLinkResult {
  id: string;
  flow: number;         // L/s
  velocity: number;     // m/s
  headloss: number;     // m/km
  status: string;
}

export interface EpanetSimulationResult {
  nodes: EpanetNodeResult[];
  links: EpanetLinkResult[];
  converged: boolean;
  iterations: number;
}

/**
 * Run a steady-state EPANET simulation.
 * Uses dynamic import for epanet-js to avoid loading WASM unless needed.
 */
export async function runSimulation(input: EpanetInput): Promise<EpanetSimulationResult> {
  const { Workspace, Project, CountType, NodeProperty, LinkProperty } = await import("epanet-js");

  const ws = new Workspace();
  const model = new Project(ws);

  try {
    // Write INP file
    const inpContent = buildINPString(input);
    ws.writeFile("model.inp", inpContent);

    // Open and solve
    model.open("model.inp", "report.rpt", "output.bin");
    model.solveH();

    // Read node results
    const nodeCount = model.getCount(CountType.NodeCount);
    const nodes: EpanetNodeResult[] = [];
    for (let i = 1; i <= nodeCount; i++) {
      const id = model.getNodeId(i);
      nodes.push({
        id,
        pressure: model.getNodeValue(i, NodeProperty.Pressure),
        head: model.getNodeValue(i, NodeProperty.Head),
        demand: model.getNodeValue(i, NodeProperty.Demand),
      });
    }

    // Read link results
    const linkCount = model.getCount(CountType.LinkCount);
    const links: EpanetLinkResult[] = [];
    for (let i = 1; i <= linkCount; i++) {
      const id = model.getLinkId(i);
      links.push({
        id,
        flow: model.getLinkValue(i, LinkProperty.Flow),
        velocity: model.getLinkValue(i, LinkProperty.Velocity),
        headloss: model.getLinkValue(i, LinkProperty.Headloss),
        status: String(model.getLinkValue(i, LinkProperty.Status)),
      });
    }

    model.close();

    return {
      nodes,
      links,
      converged: true,
      iterations: 0,
    };
  } catch (error) {
    try { model.close(); } catch { /* ignore */ }
    throw new Error(`EPANET simulation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Run an extended-period EPANET simulation.
 * Returns time-series data for each timestep.
 */
export async function runExtendedPeriod(input: EpanetInput): Promise<{
  timesteps: number[];
  nodeResults: Map<string, EpanetNodeResult[]>;
  linkResults: Map<string, EpanetLinkResult[]>;
}> {
  const { Workspace, Project, CountType, NodeProperty, LinkProperty, InitHydOption } = await import("epanet-js");

  const ws = new Workspace();
  const model = new Project(ws);

  try {
    const inpContent = buildINPString(input);
    ws.writeFile("model.inp", inpContent);
    model.open("model.inp", "report.rpt", "output.bin");

    model.openH();
    model.initH(InitHydOption.NoSave);

    const nodeCount = model.getCount(CountType.NodeCount);
    const linkCount = model.getCount(CountType.LinkCount);

    const timesteps: number[] = [];
    const nodeResults = new Map<string, EpanetNodeResult[]>();
    const linkResults = new Map<string, EpanetLinkResult[]>();

    // Initialize result arrays
    for (let i = 1; i <= nodeCount; i++) {
      nodeResults.set(model.getNodeId(i), []);
    }
    for (let i = 1; i <= linkCount; i++) {
      linkResults.set(model.getLinkId(i), []);
    }

    let t: number;
    do {
      t = model.runH();
      timesteps.push(t);

      for (let i = 1; i <= nodeCount; i++) {
        const id = model.getNodeId(i);
        nodeResults.get(id)!.push({
          id,
          pressure: model.getNodeValue(i, NodeProperty.Pressure),
          head: model.getNodeValue(i, NodeProperty.Head),
          demand: model.getNodeValue(i, NodeProperty.Demand),
        });
      }

      for (let i = 1; i <= linkCount; i++) {
        const id = model.getLinkId(i);
        linkResults.get(id)!.push({
          id,
          flow: model.getLinkValue(i, LinkProperty.Flow),
          velocity: model.getLinkValue(i, LinkProperty.Velocity),
          headloss: model.getLinkValue(i, LinkProperty.Headloss),
          status: String(model.getLinkValue(i, LinkProperty.Status)),
        });
      }

      const tstep = model.nextH();
      if (tstep <= 0) break;
    } while (true);

    model.closeH();
    model.close();

    return { timesteps, nodeResults, linkResults };
  } catch (error) {
    try { model.close(); } catch { /* ignore */ }
    throw new Error(`EPANET extended-period simulation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
