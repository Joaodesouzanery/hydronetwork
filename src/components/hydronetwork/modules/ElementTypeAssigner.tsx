/**
 * ElementTypeAssigner — Assign network element types to imported features.
 * After GIS import, users classify what each point/line represents in the network.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Tag, Zap, CheckCircle } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";

// Element type definitions per network type
const SEWER_NODE_TYPES = [
  { value: "pv", label: "PV (Poço de Visita)" },
  { value: "ci", label: "CI (Caixa de Inspeção)" },
  { value: "tl", label: "TL (Terminal de Limpeza)" },
  { value: "cr", label: "CR (Caixa de Reunião)" },
  { value: "cp", label: "CP (Caixa de Passagem)" },
  { value: "exutorio", label: "Exutório" },
] as const;

const WATER_NODE_TYPES = [
  { value: "junction", label: "Nó de Demanda" },
  { value: "reservoir", label: "Reservatório" },
  { value: "tank", label: "Tanque" },
  { value: "pump", label: "Bomba" },
  { value: "valve", label: "Válvula" },
] as const;

const SEWER_EDGE_TYPES = [
  { value: "rede", label: "Rede Coletora" },
  { value: "interceptor", label: "Interceptor" },
  { value: "emissario", label: "Emissário" },
] as const;

const WATER_EDGE_TYPES = [
  { value: "tubulacao", label: "Tubulação" },
  { value: "adutora", label: "Adutora" },
  { value: "recalque", label: "Recalque" },
] as const;

export interface ElementAssignment {
  nodeTypes: Map<string, string>;
  edgeTypes: Map<string, string>;
}

export interface ElementTypeAssignerProps {
  networkType: "esgoto" | "agua";
  pontos: PontoTopografico[];
  trechos: Trecho[];
  assignments: ElementAssignment;
  onAssignmentsChange: (assignments: ElementAssignment) => void;
}

export function ElementTypeAssigner({
  networkType,
  pontos,
  trechos,
  assignments,
  onAssignmentsChange,
}: ElementTypeAssignerProps) {
  const nodeTypes = networkType === "esgoto" ? SEWER_NODE_TYPES : WATER_NODE_TYPES;
  const edgeTypes = networkType === "esgoto" ? SEWER_EDGE_TYPES : WATER_EDGE_TYPES;
  const defaultNodeType = networkType === "esgoto" ? "pv" : "junction";
  const defaultEdgeType = networkType === "esgoto" ? "rede" : "tubulacao";

  const assignedNodeCount = useMemo(
    () => pontos.filter(p => assignments.nodeTypes.has(p.id)).length,
    [pontos, assignments.nodeTypes]
  );
  const assignedEdgeCount = useMemo(
    () => trechos.filter(t => assignments.edgeTypes.has(`${t.idInicio}-${t.idFim}`)).length,
    [trechos, assignments.edgeTypes]
  );

  const setNodeType = (nodeId: string, tipo: string) => {
    const updated = new Map(assignments.nodeTypes);
    updated.set(nodeId, tipo);
    onAssignmentsChange({ ...assignments, nodeTypes: updated });
  };

  const setEdgeType = (edgeKey: string, tipo: string) => {
    const updated = new Map(assignments.edgeTypes);
    updated.set(edgeKey, tipo);
    onAssignmentsChange({ ...assignments, edgeTypes: updated });
  };

  const autoAssignAll = () => {
    const nodeMap = new Map(assignments.nodeTypes);
    const edgeMap = new Map(assignments.edgeTypes);

    // Auto-assign all unassigned nodes and edges with defaults
    pontos.forEach(p => {
      if (!nodeMap.has(p.id)) nodeMap.set(p.id, defaultNodeType);
    });
    trechos.forEach(t => {
      const key = `${t.idInicio}-${t.idFim}`;
      if (!edgeMap.has(key)) edgeMap.set(key, defaultEdgeType);
    });

    onAssignmentsChange({ nodeTypes: nodeMap, edgeTypes: edgeMap });
    toast.success("Tipos atribuídos automaticamente");
  };

  if (pontos.length === 0 && trechos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Tag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            Importe dados na aba "Mapa" primeiro para classificar os elementos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary + auto-assign */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <Badge variant="outline">{assignedNodeCount}/{pontos.length} nós classificados</Badge>
          <Badge variant="outline">{assignedEdgeCount}/{trechos.length} trechos classificados</Badge>
        </div>
        <Button size="sm" onClick={autoAssignAll}>
          <Zap className="h-4 w-4 mr-1" /> Auto-atribuir Todos
        </Button>
      </div>

      {/* Nodes table */}
      {pontos.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Nós ({pontos.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">ID</TableHead>
                    <TableHead className="w-20">X</TableHead>
                    <TableHead className="w-20">Y</TableHead>
                    <TableHead className="w-20">Cota</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pontos.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.id}</TableCell>
                      <TableCell className="text-xs">{p.x.toFixed(1)}</TableCell>
                      <TableCell className="text-xs">{p.y.toFixed(1)}</TableCell>
                      <TableCell className="text-xs">{p.cota.toFixed(2)}</TableCell>
                      <TableCell>
                        <Select
                          value={assignments.nodeTypes.get(p.id) || ""}
                          onValueChange={(v) => setNodeType(p.id, v)}
                        >
                          <SelectTrigger className="h-7 text-xs w-[180px]">
                            <SelectValue placeholder="Selecionar tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {nodeTypes.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edges table */}
      {trechos.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Trechos ({trechos.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">De</TableHead>
                    <TableHead className="w-24">Para</TableHead>
                    <TableHead className="w-20">Comp. (m)</TableHead>
                    <TableHead className="w-20">Decliv.</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trechos.map(t => {
                    const key = `${t.idInicio}-${t.idFim}`;
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-mono text-xs">{t.idInicio}</TableCell>
                        <TableCell className="font-mono text-xs">{t.idFim}</TableCell>
                        <TableCell className="text-xs">{t.comprimento.toFixed(1)}</TableCell>
                        <TableCell className="text-xs">{(t.declividade * 100).toFixed(3)}%</TableCell>
                        <TableCell>
                          <Select
                            value={assignments.edgeTypes.get(key) || ""}
                            onValueChange={(v) => setEdgeType(key, v)}
                          >
                            <SelectTrigger className="h-7 text-xs w-[180px]">
                              <SelectValue placeholder="Selecionar tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              {edgeTypes.map(et => (
                                <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
