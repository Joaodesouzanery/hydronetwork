/**
 * AttributeTableEditor — Inline-editable attribute table for sewer/water network elements.
 * Mirrors QEsg and QWater QGIS plugin attribute table workflows.
 *
 * Sewer fields: DC_ID, PVM, PVJ, LENGTH, CTM, CTJ, CCM, CCJ, MANNING, DIAMETER, DECL, etc.
 * Water fields: DC_ID, NODE1, NODE2, LENGTH, DIAMETER, ROUGHNESS, STATUS, etc.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TableProperties, Zap, Download, MapPin, Waypoints } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { ElementAssignment } from "./ElementTypeAssigner";

// ══════════════════════════════════════
// Extended attribute schemas
// ══════════════════════════════════════

export interface SewerNodeAttributes {
  id: string;
  tipo: string;          // PV, CI, TL, CR, CP, exutorio
  cotaTerreno: number;   // CTN - terrain elevation
  cotaFundo: number;     // Cota de fundo (pipe invert)
  profundidade: number;  // Depth (CTN - cotaFundo)
  x: number;
  y: number;
  populacao: number;     // Contributing population
  vazaoConcentrada: number; // Concentrated flow (L/s)
  observacao: string;
}

export interface SewerEdgeAttributes {
  key: string;           // idInicio-idFim
  dcId: string;          // Collector segment identifier
  idInicio: string;      // PVM - upstream PV
  idFim: string;         // PVJ - downstream PV
  comprimento: number;   // LENGTH (m)
  cotaTerrenoM: number;  // CTM - terrain at upstream
  cotaTerrenoJ: number;  // CTJ - terrain at downstream
  cotaColetorM: number;  // CCM - collector crown at upstream
  cotaColetorJ: number;  // CCJ - collector crown at downstream
  manning: number;       // Manning's n coefficient
  diametro: number;      // Diameter (mm)
  declividade: number;   // Slope (m/m)
  material: string;
  contribuicaoLateral: number; // Side contribution (L/s)
  pontaSeca: number;     // Dry-weather base flow
  etapa: string;         // Construction stage
  observacao: string;
}

export interface WaterNodeAttributes {
  id: string;
  tipo: string;          // junction, reservoir, tank, pump, valve
  cota: number;          // Elevation
  demanda: number;       // Demand (L/s)
  pressao: number;       // Pressure (mca) — filled after calc
  x: number;
  y: number;
  observacao: string;
}

export interface WaterEdgeAttributes {
  key: string;           // idInicio-idFim
  dcId: string;          // Pipe identifier
  idInicio: string;      // NODE1
  idFim: string;         // NODE2
  comprimento: number;   // LENGTH (m)
  diametro: number;      // Diameter (mm)
  rugosidade: number;    // Roughness (C for HW / epsilon for DW)
  material: string;
  status: string;        // OPEN, CLOSED, CV
  vazao: number;         // Design flow (L/s)
  observacao: string;
}

// ══════════════════════════════════════
// Props
// ══════════════════════════════════════

export interface AttributeTableEditorProps {
  networkType: "esgoto" | "agua";
  pontos: PontoTopografico[];
  trechos: Trecho[];
  assignments: ElementAssignment;
  // Sewer attributes
  sewerNodes?: SewerNodeAttributes[];
  sewerEdges?: SewerEdgeAttributes[];
  onSewerNodesChange?: (nodes: SewerNodeAttributes[]) => void;
  onSewerEdgesChange?: (edges: SewerEdgeAttributes[]) => void;
  // Water attributes
  waterNodes?: WaterNodeAttributes[];
  waterEdges?: WaterEdgeAttributes[];
  onWaterNodesChange?: (nodes: WaterNodeAttributes[]) => void;
  onWaterEdgesChange?: (edges: WaterEdgeAttributes[]) => void;
}

const SEWER_MATERIALS = ["PVC", "Concreto", "PEAD", "Ferro Fundido", "Cerâmico"];
const WATER_MATERIALS = ["PVC", "PEAD", "Ferro Fundido Novo", "Ferro Fundido Usado", "Concreto", "Aço"];
const WATER_STATUS = ["OPEN", "CLOSED", "CV"];

// ══════════════════════════════════════
// Component
// ══════════════════════════════════════

export function AttributeTableEditor({
  networkType,
  pontos,
  trechos,
  assignments,
  sewerNodes = [],
  sewerEdges = [],
  onSewerNodesChange,
  onSewerEdgesChange,
  waterNodes = [],
  waterEdges = [],
  onWaterNodesChange,
  onWaterEdgesChange,
}: AttributeTableEditorProps) {
  const [activeTab, setActiveTab] = useState<"nodes" | "segments">("nodes");

  // ── Initialize/sync attributes from pontos/trechos + assignments ──

  const initSewerNodes = useCallback((): SewerNodeAttributes[] => {
    return pontos.map(p => {
      const existing = sewerNodes.find(n => n.id === p.id);
      return existing || {
        id: p.id,
        tipo: assignments.nodeTypes.get(p.id) || "pv",
        cotaTerreno: p.cota,
        cotaFundo: p.cota - 1.5, // Default 1.5m depth
        profundidade: 1.5,
        x: p.x,
        y: p.y,
        populacao: 0,
        vazaoConcentrada: 0,
        observacao: "",
      };
    });
  }, [pontos, assignments.nodeTypes, sewerNodes]);

  const initSewerEdges = useCallback((): SewerEdgeAttributes[] => {
    return trechos.map((t, i) => {
      const key = `${t.idInicio}-${t.idFim}`;
      const existing = sewerEdges.find(e => e.key === key);
      return existing || {
        key,
        dcId: `C${String(i + 1).padStart(3, "0")}`,
        idInicio: t.idInicio,
        idFim: t.idFim,
        comprimento: t.comprimento,
        cotaTerrenoM: t.cotaInicio,
        cotaTerrenoJ: t.cotaFim,
        cotaColetorM: t.cotaInicio - 1.5,
        cotaColetorJ: t.cotaFim - 1.5,
        manning: 0.013,
        diametro: t.diametroMm || 150,
        declividade: t.declividade,
        material: t.material || "PVC",
        contribuicaoLateral: 0,
        pontaSeca: 0,
        etapa: "1",
        observacao: "",
      };
    });
  }, [trechos, sewerEdges]);

  const initWaterNodes = useCallback((): WaterNodeAttributes[] => {
    return pontos.map(p => {
      const existing = waterNodes.find(n => n.id === p.id);
      return existing || {
        id: p.id,
        tipo: assignments.nodeTypes.get(p.id) || "junction",
        cota: p.cota,
        demanda: 0,
        pressao: 0,
        x: p.x,
        y: p.y,
        observacao: "",
      };
    });
  }, [pontos, assignments.nodeTypes, waterNodes]);

  const initWaterEdges = useCallback((): WaterEdgeAttributes[] => {
    return trechos.map((t, i) => {
      const key = `${t.idInicio}-${t.idFim}`;
      const existing = waterEdges.find(e => e.key === key);
      return existing || {
        key,
        dcId: `P${String(i + 1).padStart(3, "0")}`,
        idInicio: t.idInicio,
        idFim: t.idFim,
        comprimento: t.comprimento,
        diametro: t.diametroMm || 50,
        rugosidade: 150, // HW coefficient for PVC
        material: t.material || "PVC",
        status: "OPEN",
        vazao: 0,
        observacao: "",
      };
    });
  }, [trechos, waterEdges]);

  // ── Fill defaults (QEsg Button 04 equivalent) ──

  const fillDefaults = () => {
    if (networkType === "esgoto") {
      const nodes = initSewerNodes();
      const edges = initSewerEdges();
      // Fill fields from nodes: transfer terrain elevations to segments
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const filledEdges = edges.map(e => {
        const fromNode = nodeMap.get(e.idInicio);
        const toNode = nodeMap.get(e.idFim);
        return {
          ...e,
          cotaTerrenoM: fromNode?.cotaTerreno ?? e.cotaTerrenoM,
          cotaTerrenoJ: toNode?.cotaTerreno ?? e.cotaTerrenoJ,
          cotaColetorM: (fromNode?.cotaTerreno ?? e.cotaTerrenoM) - (fromNode?.profundidade ?? 1.5),
          cotaColetorJ: (toNode?.cotaTerreno ?? e.cotaTerrenoJ) - (toNode?.profundidade ?? 1.5),
          declividade: e.comprimento > 0
            ? ((fromNode?.cotaFundo ?? e.cotaColetorM) - (toNode?.cotaFundo ?? e.cotaColetorJ)) / e.comprimento
            : e.declividade,
        };
      });
      onSewerNodesChange?.(nodes);
      onSewerEdgesChange?.(filledEdges);
      toast.success("Campos preenchidos com valores padrão (nós → trechos)");
    } else {
      onWaterNodesChange?.(initWaterNodes());
      onWaterEdgesChange?.(initWaterEdges());
      toast.success("Campos preenchidos com valores padrão");
    }
  };

  // ── Bulk assignment ──

  const bulkSetMaterial = (material: string) => {
    if (networkType === "esgoto") {
      const edges = (sewerEdges.length > 0 ? sewerEdges : initSewerEdges()).map(e => ({
        ...e,
        material,
        manning: material === "Concreto" ? 0.015 : 0.013,
      }));
      onSewerEdgesChange?.(edges);
    } else {
      const HW_MAP: Record<string, number> = {
        PVC: 150, PEAD: 150, "Ferro Fundido Novo": 130,
        "Ferro Fundido Usado": 100, Concreto: 120, Aço: 120,
      };
      const edges = (waterEdges.length > 0 ? waterEdges : initWaterEdges()).map(e => ({
        ...e,
        material,
        rugosidade: HW_MAP[material] || 140,
      }));
      onWaterEdgesChange?.(edges);
    }
    toast.success(`Material definido: ${material}`);
  };

  // ── Number network (auto-assign DC_IDs) ──

  const numberNetwork = () => {
    if (networkType === "esgoto") {
      const edges = (sewerEdges.length > 0 ? sewerEdges : initSewerEdges()).map((e, i) => ({
        ...e,
        dcId: `C${String(i + 1).padStart(3, "0")}`,
      }));
      onSewerEdgesChange?.(edges);
    } else {
      const edges = (waterEdges.length > 0 ? waterEdges : initWaterEdges()).map((e, i) => ({
        ...e,
        dcId: `P${String(i + 1).padStart(3, "0")}`,
      }));
      onWaterEdgesChange?.(edges);
    }
    toast.success("Rede numerada automaticamente");
  };

  // ── Export to CSV ──

  const exportCSV = () => {
    let csv = "";
    if (networkType === "esgoto") {
      if (activeTab === "nodes") {
        csv = "ID,Tipo,Cota Terreno,Cota Fundo,Profundidade,X,Y,Populacao,Vazao Concentrada\n";
        const data = sewerNodes.length > 0 ? sewerNodes : initSewerNodes();
        data.forEach(n => {
          csv += `${n.id},${n.tipo},${n.cotaTerreno},${n.cotaFundo},${n.profundidade},${n.x},${n.y},${n.populacao},${n.vazaoConcentrada}\n`;
        });
      } else {
        csv = "DC_ID,PVM,PVJ,Comprimento,CTM,CTJ,CCM,CCJ,Manning,Diametro,Declividade,Material,Contrib Lateral,Ponta Seca,Etapa\n";
        const data = sewerEdges.length > 0 ? sewerEdges : initSewerEdges();
        data.forEach(e => {
          csv += `${e.dcId},${e.idInicio},${e.idFim},${e.comprimento},${e.cotaTerrenoM},${e.cotaTerrenoJ},${e.cotaColetorM},${e.cotaColetorJ},${e.manning},${e.diametro},${e.declividade},${e.material},${e.contribuicaoLateral},${e.pontaSeca},${e.etapa}\n`;
        });
      }
    } else {
      if (activeTab === "nodes") {
        csv = "ID,Tipo,Cota,Demanda,X,Y\n";
        const data = waterNodes.length > 0 ? waterNodes : initWaterNodes();
        data.forEach(n => {
          csv += `${n.id},${n.tipo},${n.cota},${n.demanda},${n.x},${n.y}\n`;
        });
      } else {
        csv = "DC_ID,NODE1,NODE2,Comprimento,Diametro,Rugosidade,Material,Status,Vazao\n";
        const data = waterEdges.length > 0 ? waterEdges : initWaterEdges();
        data.forEach(e => {
          csv += `${e.dcId},${e.idInicio},${e.idFim},${e.comprimento},${e.diametro},${e.rugosidade},${e.material},${e.status},${e.vazao}\n`;
        });
      }
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${networkType}_${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  // ── Cell edit handlers ──

  const updateSewerNode = (id: string, field: keyof SewerNodeAttributes, value: string | number) => {
    const data = sewerNodes.length > 0 ? [...sewerNodes] : initSewerNodes();
    const idx = data.findIndex(n => n.id === id);
    if (idx < 0) return;
    const node = { ...data[idx], [field]: value };
    // Auto-calculate depth
    if (field === "cotaTerreno" || field === "cotaFundo") {
      node.profundidade = Math.round((node.cotaTerreno - node.cotaFundo) * 100) / 100;
    }
    if (field === "profundidade") {
      node.cotaFundo = Math.round((node.cotaTerreno - (value as number)) * 100) / 100;
    }
    data[idx] = node;
    onSewerNodesChange?.(data);
  };

  const updateSewerEdge = (key: string, field: keyof SewerEdgeAttributes, value: string | number) => {
    const data = sewerEdges.length > 0 ? [...sewerEdges] : initSewerEdges();
    const idx = data.findIndex(e => e.key === key);
    if (idx < 0) return;
    const edge = { ...data[idx], [field]: value };
    // Auto-calculate slope from collector elevations
    if ((field === "cotaColetorM" || field === "cotaColetorJ") && edge.comprimento > 0) {
      edge.declividade = Math.round(((edge.cotaColetorM - edge.cotaColetorJ) / edge.comprimento) * 1e6) / 1e6;
    }
    data[idx] = edge;
    onSewerEdgesChange?.(data);
  };

  const updateWaterNode = (id: string, field: keyof WaterNodeAttributes, value: string | number) => {
    const data = waterNodes.length > 0 ? [...waterNodes] : initWaterNodes();
    const idx = data.findIndex(n => n.id === id);
    if (idx < 0) return;
    data[idx] = { ...data[idx], [field]: value };
    onWaterNodesChange?.(data);
  };

  const updateWaterEdge = (key: string, field: keyof WaterEdgeAttributes, value: string | number) => {
    const data = waterEdges.length > 0 ? [...waterEdges] : initWaterEdges();
    const idx = data.findIndex(e => e.key === key);
    if (idx < 0) return;
    data[idx] = { ...data[idx], [field]: value };
    onWaterEdgesChange?.(data);
  };

  // ── Empty state ──

  if (pontos.length === 0 && trechos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <TableProperties className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            Importe dados na aba "Mapa" primeiro para editar a tabela de atributos.
          </p>
        </CardContent>
      </Card>
    );
  }

  const materials = networkType === "esgoto" ? SEWER_MATERIALS : WATER_MATERIALS;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            {pontos.length} nós
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Waypoints className="h-3 w-3 mr-1" />
            {trechos.length} trechos
          </Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={fillDefaults}>
            <Zap className="h-4 w-4 mr-1" /> Preencher Padrões
          </Button>
          <Button size="sm" variant="outline" onClick={numberNetwork}>
            <Waypoints className="h-4 w-4 mr-1" /> Numerar Rede
          </Button>
          <Select onValueChange={bulkSetMaterial}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue placeholder="Material..." />
            </SelectTrigger>
            <SelectContent>
              {materials.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Tabs: Nodes / Segments */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "nodes" | "segments")}>
        <TabsList className="grid grid-cols-2 w-[240px]">
          <TabsTrigger value="nodes">
            <MapPin className="h-4 w-4 mr-1" /> Nós
          </TabsTrigger>
          <TabsTrigger value="segments">
            <Waypoints className="h-4 w-4 mr-1" /> Trechos
          </TabsTrigger>
        </TabsList>

        {/* ── Sewer Node Table ── */}
        {networkType === "esgoto" && (
          <TabsContent value="nodes">
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20 sticky left-0 bg-background z-10">ID</TableHead>
                        <TableHead className="w-20">Tipo</TableHead>
                        <TableHead className="w-20">CT (m)</TableHead>
                        <TableHead className="w-20">CF (m)</TableHead>
                        <TableHead className="w-20">Prof (m)</TableHead>
                        <TableHead className="w-16">Pop</TableHead>
                        <TableHead className="w-20">Q conc (L/s)</TableHead>
                        <TableHead className="w-20">X</TableHead>
                        <TableHead className="w-20">Y</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(sewerNodes.length > 0 ? sewerNodes : initSewerNodes()).map(n => (
                        <TableRow key={n.id}>
                          <TableCell className="font-mono text-xs sticky left-0 bg-background z-10">{n.id}</TableCell>
                          <TableCell>
                            <span className="text-xs font-medium">{n.tipo.toUpperCase()}</span>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-20"
                              value={n.cotaTerreno}
                              onChange={e => updateSewerNode(n.id, "cotaTerreno", parseFloat(e.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-20"
                              value={n.cotaFundo}
                              onChange={e => updateSewerNode(n.id, "cotaFundo", parseFloat(e.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-20"
                              value={n.profundidade}
                              onChange={e => updateSewerNode(n.id, "profundidade", parseFloat(e.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="1"
                              className="h-7 text-xs w-16"
                              value={n.populacao}
                              onChange={e => updateSewerNode(n.id, "populacao", parseInt(e.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-20"
                              value={n.vazaoConcentrada}
                              onChange={e => updateSewerNode(n.id, "vazaoConcentrada", parseFloat(e.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell className="text-xs">{n.x.toFixed(1)}</TableCell>
                          <TableCell className="text-xs">{n.y.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Sewer Edge Table ── */}
        {networkType === "esgoto" && (
          <TabsContent value="segments">
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 sticky left-0 bg-background z-10">DC_ID</TableHead>
                        <TableHead className="w-16">PVM</TableHead>
                        <TableHead className="w-16">PVJ</TableHead>
                        <TableHead className="w-20">Comp (m)</TableHead>
                        <TableHead className="w-20">CTM (m)</TableHead>
                        <TableHead className="w-20">CTJ (m)</TableHead>
                        <TableHead className="w-20">CCM (m)</TableHead>
                        <TableHead className="w-20">CCJ (m)</TableHead>
                        <TableHead className="w-16">n</TableHead>
                        <TableHead className="w-20">DN (mm)</TableHead>
                        <TableHead className="w-20">Decl (%)</TableHead>
                        <TableHead className="w-20">Material</TableHead>
                        <TableHead className="w-16">Q lat</TableHead>
                        <TableHead className="w-14">PS</TableHead>
                        <TableHead className="w-16">Etapa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(sewerEdges.length > 0 ? sewerEdges : initSewerEdges()).map(e => (
                        <TableRow key={e.key}>
                          <TableCell className="font-mono text-xs sticky left-0 bg-background z-10">
                            <Input
                              className="h-7 text-xs w-16"
                              value={e.dcId}
                              onChange={ev => updateSewerEdge(e.key, "dcId", ev.target.value)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{e.idInicio}</TableCell>
                          <TableCell className="font-mono text-xs">{e.idFim}</TableCell>
                          <TableCell className="text-xs">{e.comprimento.toFixed(1)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-20"
                              value={e.cotaTerrenoM}
                              onChange={ev => updateSewerEdge(e.key, "cotaTerrenoM", parseFloat(ev.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-20"
                              value={e.cotaTerrenoJ}
                              onChange={ev => updateSewerEdge(e.key, "cotaTerrenoJ", parseFloat(ev.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-20"
                              value={e.cotaColetorM}
                              onChange={ev => updateSewerEdge(e.key, "cotaColetorM", parseFloat(ev.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-20"
                              value={e.cotaColetorJ}
                              onChange={ev => updateSewerEdge(e.key, "cotaColetorJ", parseFloat(ev.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.001"
                              className="h-7 text-xs w-16"
                              value={e.manning}
                              onChange={ev => updateSewerEdge(e.key, "manning", parseFloat(ev.target.value) || 0.013)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="50"
                              className="h-7 text-xs w-20"
                              value={e.diametro}
                              onChange={ev => updateSewerEdge(e.key, "diametro", parseFloat(ev.target.value) || 150)}
                            />
                          </TableCell>
                          <TableCell className="text-xs">{(e.declividade * 100).toFixed(3)}%</TableCell>
                          <TableCell>
                            <Select value={e.material} onValueChange={v => updateSewerEdge(e.key, "material", v)}>
                              <SelectTrigger className="h-7 text-xs w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SEWER_MATERIALS.map(m => (
                                  <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              className="h-7 text-xs w-16"
                              value={e.contribuicaoLateral}
                              onChange={ev => updateSewerEdge(e.key, "contribuicaoLateral", parseFloat(ev.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={e.pontaSeca > 0}
                              onChange={ev => updateSewerEdge(e.key, "pontaSeca", ev.target.checked ? 1 : 0)}
                              className="h-4 w-4 accent-amber-500 cursor-pointer"
                              title="Ponta Seca"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-7 text-xs w-16"
                              value={e.etapa}
                              onChange={ev => updateSewerEdge(e.key, "etapa", ev.target.value)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Water Node Table ── */}
        {networkType === "agua" && (
          <TabsContent value="nodes">
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20 sticky left-0 bg-background z-10">ID</TableHead>
                        <TableHead className="w-24">Tipo</TableHead>
                        <TableHead className="w-20">Cota (m)</TableHead>
                        <TableHead className="w-20">Demanda (L/s)</TableHead>
                        <TableHead className="w-20">X</TableHead>
                        <TableHead className="w-20">Y</TableHead>
                        <TableHead className="w-24">Obs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(waterNodes.length > 0 ? waterNodes : initWaterNodes()).map(n => (
                        <TableRow key={n.id}>
                          <TableCell className="font-mono text-xs sticky left-0 bg-background z-10">{n.id}</TableCell>
                          <TableCell>
                            <span className="text-xs font-medium">{n.tipo}</span>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-20"
                              value={n.cota}
                              onChange={e => updateWaterNode(n.id, "cota", parseFloat(e.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs w-20"
                              value={n.demanda}
                              onChange={e => updateWaterNode(n.id, "demanda", parseFloat(e.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell className="text-xs">{n.x.toFixed(1)}</TableCell>
                          <TableCell className="text-xs">{n.y.toFixed(1)}</TableCell>
                          <TableCell>
                            <Input
                              className="h-7 text-xs w-24"
                              value={n.observacao}
                              onChange={e => updateWaterNode(n.id, "observacao", e.target.value)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Water Edge Table ── */}
        {networkType === "agua" && (
          <TabsContent value="segments">
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 sticky left-0 bg-background z-10">DC_ID</TableHead>
                        <TableHead className="w-16">Nó 1</TableHead>
                        <TableHead className="w-16">Nó 2</TableHead>
                        <TableHead className="w-20">Comp (m)</TableHead>
                        <TableHead className="w-20">DN (mm)</TableHead>
                        <TableHead className="w-20">C (HW)</TableHead>
                        <TableHead className="w-24">Material</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                        <TableHead className="w-20">Q (L/s)</TableHead>
                        <TableHead className="w-24">Obs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(waterEdges.length > 0 ? waterEdges : initWaterEdges()).map(e => (
                        <TableRow key={e.key}>
                          <TableCell className="font-mono text-xs sticky left-0 bg-background z-10">
                            <Input
                              className="h-7 text-xs w-16"
                              value={e.dcId}
                              onChange={ev => updateWaterEdge(e.key, "dcId", ev.target.value)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{e.idInicio}</TableCell>
                          <TableCell className="font-mono text-xs">{e.idFim}</TableCell>
                          <TableCell className="text-xs">{e.comprimento.toFixed(1)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="25"
                              className="h-7 text-xs w-20"
                              value={e.diametro}
                              onChange={ev => updateWaterEdge(e.key, "diametro", parseFloat(ev.target.value) || 50)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="5"
                              className="h-7 text-xs w-20"
                              value={e.rugosidade}
                              onChange={ev => updateWaterEdge(e.key, "rugosidade", parseFloat(ev.target.value) || 140)}
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={e.material} onValueChange={v => updateWaterEdge(e.key, "material", v)}>
                              <SelectTrigger className="h-7 text-xs w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {WATER_MATERIALS.map(m => (
                                  <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={e.status} onValueChange={v => updateWaterEdge(e.key, "status", v)}>
                              <SelectTrigger className="h-7 text-xs w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {WATER_STATUS.map(s => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              className="h-7 text-xs w-20"
                              value={e.vazao}
                              onChange={ev => updateWaterEdge(e.key, "vazao", parseFloat(ev.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-7 text-xs w-24"
                              value={e.observacao}
                              onChange={ev => updateWaterEdge(e.key, "observacao", ev.target.value)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
