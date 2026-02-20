/**
 * Import Validation — Post-import validation report.
 * Alerts only, NEVER auto-corrects without user confirmation.
 */

import { SpatialNode, SpatialEdge, getSpatialProject } from "@/core/spatial";

export interface ValidationIssue {
  type: "duplicate_node" | "disconnected_edge" | "invalid_geometry" | "crs_mismatch"
    | "negative_z" | "length_mismatch" | "missing_z" | "zero_length";
  severity: "error" | "warning" | "info";
  message: string;
  elementId?: string;
}

export interface ValidationReport {
  duplicateNodes: { count: number; items: { node1: string; node2: string; distance: number }[] };
  disconnectedEdges: { count: number; items: string[] };
  invalidGeometries: { count: number; items: { id: string; reason: string }[] };
  crsInconsistencies: { count: number; items: { id: string; expectedSrid: number; foundSrid: number }[] };
  negativeZ: { count: number; items: string[] };
  lengthDiscrepancies: { count: number; items: { id: string; calculated: number; stored: number }[] };
  zeroLength: { count: number; items: string[] };
  totalIssues: number;
}

/** Run full validation on the current project */
export function validateProject(): ValidationIssue[] {
  const project = getSpatialProject();
  const issues: ValidationIssue[] = [];

  // Check duplicate node positions
  const nodePositions = new Map<string, string>();
  project.nodes.forEach((node) => {
    const key = `${node.x.toFixed(3)},${node.y.toFixed(3)}`;
    if (nodePositions.has(key)) {
      issues.push({
        type: "duplicate_node",
        severity: "warning",
        message: `Nó ${node.id} na mesma posição que ${nodePositions.get(key)}`,
        elementId: node.id,
      });
    }
    nodePositions.set(key, node.id);
  });

  // Check edges with missing nodes
  project.edges.forEach((edge) => {
    if (!project.nodes.has(edge.startNodeId)) {
      issues.push({
        type: "disconnected_edge",
        severity: "error",
        message: `Trecho ${edge.id}: nó início '${edge.startNodeId}' não encontrado`,
        elementId: edge.id,
      });
    }
    if (!project.nodes.has(edge.endNodeId)) {
      issues.push({
        type: "disconnected_edge",
        severity: "error",
        message: `Trecho ${edge.id}: nó fim '${edge.endNodeId}' não encontrado`,
        elementId: edge.id,
      });
    }
  });

  // Check negative Z
  project.nodes.forEach((node) => {
    if (node.z < -100) {
      issues.push({
        type: "negative_z",
        severity: "warning",
        message: `Nó ${node.id}: Z muito negativo (${node.z.toFixed(2)})`,
        elementId: node.id,
      });
    }
  });

  // Check zero-length edges
  project.edges.forEach((edge) => {
    if (edge.comprimento <= 0.001) {
      issues.push({
        type: "zero_length",
        severity: "error",
        message: `Trecho ${edge.id}: comprimento zero ou negativo`,
        elementId: edge.id,
      });
    }
  });

  // Check nodes with no Z
  project.nodes.forEach((node) => {
    if (node.z === 0) {
      issues.push({
        type: "missing_z",
        severity: "info",
        message: `Nó ${node.id}: sem elevação (Z=0)`,
        elementId: node.id,
      });
    }
  });

  return issues;
}

/** Build a structured validation report from issues */
export function buildValidationReport(issues: ValidationIssue[]): ValidationReport {
  const report: ValidationReport = {
    duplicateNodes: { count: 0, items: [] },
    disconnectedEdges: { count: 0, items: [] },
    invalidGeometries: { count: 0, items: [] },
    crsInconsistencies: { count: 0, items: [] },
    negativeZ: { count: 0, items: [] },
    lengthDiscrepancies: { count: 0, items: [] },
    zeroLength: { count: 0, items: [] },
    totalIssues: issues.length,
  };

  for (const issue of issues) {
    switch (issue.type) {
      case "duplicate_node":
        report.duplicateNodes.count++;
        break;
      case "disconnected_edge":
        report.disconnectedEdges.count++;
        if (issue.elementId) report.disconnectedEdges.items.push(issue.elementId);
        break;
      case "negative_z":
        report.negativeZ.count++;
        if (issue.elementId) report.negativeZ.items.push(issue.elementId);
        break;
      case "zero_length":
      case "length_mismatch":
        report.zeroLength.count++;
        if (issue.elementId) report.zeroLength.items.push(issue.elementId);
        break;
    }
  }

  return report;
}

/** Validate a set of nodes/edges before importing (pre-import check) */
export function validateImportData(
  nodes: Array<{ id: string; x: number; y: number; z: number }>,
  edges: Array<{ id: string; startNodeId: string; endNodeId: string; comprimento?: number }>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(nodes.map(n => n.id));

  // Check for edges referencing non-existent nodes
  for (const e of edges) {
    if (!nodeIds.has(e.startNodeId)) {
      issues.push({
        type: "disconnected_edge",
        severity: "error",
        message: `Trecho ${e.id}: nó início '${e.startNodeId}' não existe nos dados importados`,
        elementId: e.id,
      });
    }
    if (!nodeIds.has(e.endNodeId)) {
      issues.push({
        type: "disconnected_edge",
        severity: "error",
        message: `Trecho ${e.id}: nó fim '${e.endNodeId}' não existe nos dados importados`,
        elementId: e.id,
      });
    }
  }

  // Check duplicate IDs
  const seenIds = new Set<string>();
  for (const n of nodes) {
    if (seenIds.has(n.id)) {
      issues.push({
        type: "duplicate_node",
        severity: "warning",
        message: `ID duplicado: ${n.id}`,
        elementId: n.id,
      });
    }
    seenIds.add(n.id);
  }

  return issues;
}
