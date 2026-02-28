/**
 * Shared hook for network module logic (Sewer & Water).
 *
 * Extracts the common patterns from SewerModule and WaterModule:
 * - Node CRUD (add / delete / transfer from topography / load demo)
 * - Segment building from consecutive nodes
 * - Map connections management
 * - Result management (apply diameters, export CSV)
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { ConnectionData } from "@/components/hydronetwork/NodeMapWidget";

// ── Generic network node ──

export interface NetworkNode {
  id: string;
  x: number;
  y: number;
  [key: string]: any;
}

export interface UseNetworkModuleOptions<TNode extends NetworkNode, TResult extends { id: string; atendeNorma: boolean; observacoes: string[] }> {
  /** Filter function to select relevant trechos */
  filterTrechos: (t: Trecho) => boolean;
  /** Color for map connections */
  accentColor: string;
  /** CSV filename for export */
  csvFilename: string;
  /** CSV header row */
  csvHeader: string;
  /** Format a result row as CSV */
  formatCsvRow: (r: TResult) => string;
  /** Build display name for node */
  nodeLabel?: string;
}

export function useNetworkModule<
  TNode extends NetworkNode,
  TResult extends { id: string; diametroMm: number; atendeNorma: boolean; observacoes: string[] },
>(
  pontos: PontoTopografico[],
  trechos: Trecho[],
  onTrechosChange: (t: Trecho[]) => void,
  options: UseNetworkModuleOptions<TNode, TResult>,
) {
  const [nodes, setNodes] = useState<TNode[]>([]);
  const [mapConnections, setMapConnections] = useState<ConnectionData[]>([]);
  const [results, setResults] = useState<TResult[]>([]);
  const [resumo, setResumo] = useState<{ total: number; atendem: number } | null>(null);
  const [autoApply, setAutoApply] = useState(false);

  const filteredTrechos = useMemo(
    () => trechos.filter(options.filterTrechos),
    [trechos, options.filterTrechos],
  );

  // ── Node Management ──

  const addNode = useCallback((node: TNode) => {
    if (!node.id.trim()) { toast.error("ID obrigatório"); return false; }
    if (nodes.some(n => n.id === node.id)) { toast.error("ID já existe"); return false; }
    setNodes(prev => [...prev, node]);
    return true;
  }, [nodes]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
  }, []);

  const deleteNodes = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setNodes(prev => prev.filter(n => !idSet.has(n.id)));
  }, []);

  const updateNode = useCallback((nodeId: string, updates: Partial<TNode>) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
  }, []);

  const setAllNodes = useCallback((newNodes: TNode[]) => {
    setNodes(newNodes);
    setMapConnections(newNodes.slice(0, -1).map((n, i) => ({
      from: n.id,
      to: newNodes[i + 1].id,
      color: options.accentColor,
      label: `${n.id} > ${newNodes[i + 1].id}`,
    })));
  }, [options.accentColor]);

  // ── Build segments from consecutive nodes ──

  const buildSegmentsFromNodes = useCallback((nodeList: TNode[]): Array<{
    id: string;
    comprimento: number;
    from: TNode;
    to: TNode;
  }> => {
    const segments: Array<{ id: string; comprimento: number; from: TNode; to: TNode }> = [];
    for (let i = 0; i < nodeList.length - 1; i++) {
      const de = nodeList[i];
      const para = nodeList[i + 1];
      const dx = para.x - de.x;
      const dy = para.y - de.y;
      const comp = Math.sqrt(dx * dx + dy * dy);
      segments.push({
        id: `${de.id}-${para.id}`,
        comprimento: Math.round(comp * 10) / 10,
        from: de,
        to: para,
      });
    }
    return segments;
  }, []);

  // ── Results management ──

  const setDimensionResults = useCallback((
    resultados: TResult[],
    resumoData: { total: number; atendem: number; naoAtendem: number },
  ) => {
    setResults(resultados);
    setResumo({ total: resumoData.total, atendem: resumoData.atendem });
  }, []);

  const applyDiameters = useCallback(() => {
    if (results.length === 0) return;
    const m = new Map(results.map(r => [r.id, r.diametroMm]));
    onTrechosChange(trechos.map(t => {
      const d = m.get(`${t.idInicio}-${t.idFim}`);
      return d ? { ...t, diametroMm: d } : t;
    }));
  }, [results, trechos, onTrechosChange]);

  useEffect(() => {
    if (autoApply && results.length > 0) {
      applyDiameters();
      setAutoApply(false);
    }
  }, [autoApply, results, applyDiameters]);

  const handleRebuild = useCallback((dimensionFn: () => void) => {
    setAutoApply(true);
    dimensionFn();
  }, []);

  // ── CSV export ──

  const exportCSV = useCallback(() => {
    if (results.length === 0) return;
    const rows = results.map(options.formatCsvRow);
    const csv = [options.csvHeader, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = options.csvFilename;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, options.csvHeader, options.csvFilename, options.formatCsvRow]);

  // ── Summary stats ──

  const alertCount = results.filter(r => !r.atendeNorma).length;
  const compliance = resumo
    ? Math.round((resumo.atendem / Math.max(resumo.total, 1)) * 100)
    : 0;

  return {
    // Node state
    nodes,
    setNodes,
    addNode,
    deleteNode,
    deleteNodes,
    updateNode,
    setAllNodes,

    // Map
    mapConnections,
    setMapConnections,

    // Trechos
    filteredTrechos,
    buildSegmentsFromNodes,

    // Results
    results,
    setResults,
    resumo,
    setDimensionResults,
    applyDiameters,
    handleRebuild,
    exportCSV,

    // Stats
    alertCount,
    compliance,
  };
}
