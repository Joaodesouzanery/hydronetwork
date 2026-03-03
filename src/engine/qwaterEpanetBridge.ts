/**
 * QWater ↔ EPANET Bridge — Converts QWater module data to EPANET input format
 * and maps simulation results back to water network attributes.
 *
 * This bridge enables seamless round-trip between the HydroNetwork water
 * attribute model (WaterNodeAttributes / WaterEdgeAttributes) and the
 * EPANET hydraulic solver via epanetRunner.
 */

import {
  type EpanetInput,
  type EpanetJunction,
  type EpanetReservoir,
  type EpanetPipe,
  type EpanetOptions,
  type EpanetSimulationResult,
  buildINPString,
  runSimulation,
} from "./epanetRunner";

import type {
  WaterNodeAttributes,
  WaterEdgeAttributes,
} from "@/components/hydronetwork/modules/AttributeTableEditor";

// ══════════════════════════════════════
// QWater → EPANET conversion
// ══════════════════════════════════════

/**
 * Convert QWater water network attributes into a structured EpanetInput
 * ready for INP generation or direct simulation.
 *
 * - Nodes with tipo === "reservoir" become EpanetReservoir (head = cota).
 * - All other nodes become EpanetJunction (elevation = cota, demand = demanda).
 * - Edges become EpanetPipe with mapped fields.
 *
 * Default EPANET options: units = "LPS", headlossFormula = "H-W".
 */
export function waterToEpanetInput(
  nodeAttrs: WaterNodeAttributes[],
  edgeAttrs: WaterEdgeAttributes[],
  options?: Partial<EpanetOptions>,
): EpanetInput {
  const junctions: EpanetJunction[] = [];
  const reservoirs: EpanetReservoir[] = [];

  for (const node of nodeAttrs) {
    if (node.tipo === "reservoir") {
      reservoirs.push({
        id: node.id,
        head: node.cota,
      });
    } else {
      junctions.push({
        id: node.id,
        elevation: node.cota,
        demand: node.demanda,
      });
    }
  }

  const pipes: EpanetPipe[] = edgeAttrs.map((edge) => ({
    id: edge.dcId || edge.key,
    node1: edge.idInicio,
    node2: edge.idFim,
    length: edge.comprimento,
    diameter: edge.diametro,
    roughness: edge.rugosidade,
    status: (edge.status as EpanetPipe["status"]) || "OPEN",
  }));

  const mergedOptions: EpanetOptions = {
    units: "LPS",
    headlossFormula: "H-W",
    ...options,
  };

  return {
    junctions,
    reservoirs,
    tanks: [],
    pipes,
    pumps: [],
    curves: [],
    options: mergedOptions,
  };
}

// ══════════════════════════════════════
// EPANET → QWater result mapping
// ══════════════════════════════════════

/**
 * Map EPANET simulation results back to WaterNodeAttributes.
 *
 * - Node pressure (mca) is written to each WaterNodeAttributes.pressao.
 * - Link results (flow, velocity, headloss) are returned separately for
 *   display in attribute tables or map overlays.
 */
export function epanetResultsToWater(
  result: EpanetSimulationResult,
  nodeAttrs: WaterNodeAttributes[],
): {
  updatedNodes: WaterNodeAttributes[];
  linkResults: { id: string; flow: number; velocity: number; headloss: number }[];
} {
  // Build a lookup from EPANET node results by id
  const nodeResultMap = new Map(
    result.nodes.map((nr) => [nr.id, nr]),
  );

  const updatedNodes = nodeAttrs.map((node) => {
    const epaResult = nodeResultMap.get(node.id);
    if (epaResult) {
      return {
        ...node,
        pressao: epaResult.pressure,
      };
    }
    return { ...node };
  });

  const linkResults = result.links.map((lr) => ({
    id: lr.id,
    flow: lr.flow,
    velocity: lr.velocity,
    headloss: lr.headloss,
  }));

  return { updatedNodes, linkResults };
}

// ══════════════════════════════════════
// Convenience functions
// ══════════════════════════════════════

/**
 * Generate an EPANET .inp file string directly from QWater attributes.
 * Convenience wrapper: waterToEpanetInput → buildINPString.
 */
export function generateINPFromWater(
  nodeAttrs: WaterNodeAttributes[],
  edgeAttrs: WaterEdgeAttributes[],
  options?: Partial<EpanetOptions>,
): string {
  const input = waterToEpanetInput(nodeAttrs, edgeAttrs, options);
  return buildINPString(input);
}

/**
 * Run an EPANET hydraulic simulation directly from QWater attributes.
 * Convenience wrapper: waterToEpanetInput → runSimulation.
 */
export async function runWaterEpanet(
  nodeAttrs: WaterNodeAttributes[],
  edgeAttrs: WaterEdgeAttributes[],
  options?: Partial<EpanetOptions>,
): Promise<EpanetSimulationResult> {
  const input = waterToEpanetInput(nodeAttrs, edgeAttrs, options);
  return runSimulation(input);
}
