/**
 * Edit Behaviors — QGIS-like spatial editing tools.
 */

export interface EditingToolsState {
  // Selection
  selectSingle: boolean;
  selectMultiple: boolean;
  selectByRectangle: boolean;

  // Movement
  moveNode: boolean;
  moveVertex: boolean;

  // Vertex editing
  insertVertex: boolean;
  deleteVertex: boolean;

  // Snap
  snapEnabled: boolean;
  snapTolerance: number;  // In meters
  snapToNode: boolean;
  snapToVertex: boolean;
  snapToEdge: boolean;

  // Delete
  deleteWithValidation: boolean;
}

export function getDefaultEditingTools(): EditingToolsState {
  return {
    selectSingle: true,
    selectMultiple: false,
    selectByRectangle: false,
    moveNode: false,
    moveVertex: false,
    insertVertex: false,
    deleteVertex: false,
    snapEnabled: true,
    snapTolerance: 0.01,
    snapToNode: true,
    snapToVertex: true,
    snapToEdge: false,
    deleteWithValidation: true,
  };
}

export type EditTool = "select" | "select_rect" | "move_node" | "move_vertex"
  | "insert_vertex" | "delete_vertex" | "add_node" | "add_edge" | "delete" | "none";

export function activateTool(state: EditingToolsState, tool: EditTool): EditingToolsState {
  // Reset all tools
  const reset: EditingToolsState = {
    ...state,
    selectSingle: false,
    selectMultiple: false,
    selectByRectangle: false,
    moveNode: false,
    moveVertex: false,
    insertVertex: false,
    deleteVertex: false,
  };

  switch (tool) {
    case "select": return { ...reset, selectSingle: true };
    case "select_rect": return { ...reset, selectByRectangle: true };
    case "move_node": return { ...reset, moveNode: true };
    case "move_vertex": return { ...reset, moveVertex: true };
    case "insert_vertex": return { ...reset, insertVertex: true };
    case "delete_vertex": return { ...reset, deleteVertex: true };
    default: return reset;
  }
}

/**
 * Find nearest node within snap tolerance.
 */
export function findSnapTarget(
  x: number,
  y: number,
  nodes: Array<{ id: string; x: number; y: number }>,
  tolerance: number
): { id: string; x: number; y: number } | null {
  let closest: typeof nodes[0] | null = null;
  let minDist = tolerance;

  for (const node of nodes) {
    const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
    if (dist < minDist) {
      minDist = dist;
      closest = node;
    }
  }

  return closest;
}
